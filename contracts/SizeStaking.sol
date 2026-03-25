// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title SizeStaking
 * @notice Tier-based staking for $SIZE token on Base.
 *         Trading fees (75% in $SIZE) are deposited and distributed
 *         proportionally to stakers weighted by their tier boost.
 *
 *         Tiers:
 *           Grower  — 100K+   $SIZE — 1x  boost
 *           Shower  — 1M+     $SIZE — 2x  boost
 *           Shlong  — 10M+    $SIZE — 5x  boost
 *           Whale   — 100M+   $SIZE — 12x boost
 */
contract SizeStaking is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────────────────────────

    IERC20 public immutable sizeToken;

    uint256 public constant GROWER_MIN  = 100_000e18;
    uint256 public constant SHOWER_MIN  = 1_000_000e18;
    uint256 public constant SHLONG_MIN  = 10_000_000e18;
    uint256 public constant WHALE_MIN   = 100_000_000e18;

    // Boost multipliers in basis points (10_000 = 1x)
    uint256 public constant GROWER_BOOST  = 10_000;   // 1x
    uint256 public constant SHOWER_BOOST  = 20_000;   // 2x
    uint256 public constant SHLONG_BOOST  = 50_000;   // 5x
    uint256 public constant WHALE_BOOST   = 120_000;  // 12x

    uint256 private constant PRECISION = 1e18;

    // ──────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────

    struct StakeInfo {
        uint256 amount;          // raw tokens staked
        uint256 rewardDebt;      // accRewardPerShare snapshot × effective stake
        uint256 pendingRewards;  // claimable but unclaimed
        uint64  stakedAt;        // timestamp of first/latest stake
        uint64  lastClaimAt;     // timestamp of last claim
    }

    mapping(address => StakeInfo) public stakes;

    uint256 public totalStaked;
    uint256 public totalEffectiveStaked;
    uint256 public accRewardPerShare;   // scaled by PRECISION
    uint256 public bufferedRewards;     // rewards deposited when no stakers

    // Authorised fee depositors (owner + approved bots)
    mapping(address => bool) public isDepositor;

    // ──────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 newTier);
    event Unstaked(address indexed user, uint256 amount, uint256 newTier);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(address indexed depositor, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event DepositorUpdated(address indexed depositor, bool status);

    // ──────────────────────────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────────────────────────

    error ZeroAmount();
    error BelowMinimumTier(uint256 resultingBalance, uint256 minimum);
    error ExceedsStake(uint256 requested, uint256 staked);
    error NotDepositor();
    error NothingToClaim();

    // ──────────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor(address _sizeToken) Ownable(msg.sender) {
        sizeToken = IERC20(_sizeToken);
        isDepositor[msg.sender] = true;
    }

    // ──────────────────────────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────────────────────────

    modifier onlyDepositor() {
        if (!isDepositor[msg.sender] && msg.sender != owner())
            revert NotDepositor();
        _;
    }

    // ──────────────────────────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────────────────────────

    function setDepositor(address _depositor, bool _status) external onlyOwner {
        isDepositor[_depositor] = _status;
        emit DepositorUpdated(_depositor, _status);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ──────────────────────────────────────────────────────────────────
    // Core: Stake
    // ──────────────────────────────────────────────────────────────────

    function stake(uint256 _amount) external nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();

        StakeInfo storage s = stakes[msg.sender];
        uint256 newBalance = s.amount + _amount;

        if (newBalance < GROWER_MIN)
            revert BelowMinimumTier(newBalance, GROWER_MIN);

        // Settle pending rewards before changing stake
        _settle(msg.sender);

        // Remove old effective stake
        if (s.amount > 0) {
            totalEffectiveStaked -= _effectiveStake(s.amount);
        }

        // Update position
        s.amount = newBalance;
        totalStaked += _amount;
        totalEffectiveStaked += _effectiveStake(newBalance);

        // Reset reward debt to current checkpoint
        s.rewardDebt = (_effectiveStake(newBalance) * accRewardPerShare) / PRECISION;
        s.stakedAt = uint64(block.timestamp);

        // Flush any buffered rewards now that there are stakers
        if (bufferedRewards > 0 && totalEffectiveStaked > 0) {
            accRewardPerShare += (bufferedRewards * PRECISION) / totalEffectiveStaked;
            // Re-checkpoint debt after flush
            s.rewardDebt = (_effectiveStake(newBalance) * accRewardPerShare) / PRECISION;
            bufferedRewards = 0;
        }

        sizeToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount, getTier(msg.sender));
    }

    // ──────────────────────────────────────────────────────────────────
    // Core: Unstake
    // ──────────────────────────────────────────────────────────────────

    function unstake(uint256 _amount) external nonReentrant whenNotPaused {
        StakeInfo storage s = stakes[msg.sender];
        if (_amount == 0) revert ZeroAmount();
        if (_amount > s.amount) revert ExceedsStake(_amount, s.amount);

        // Settle pending rewards
        _settle(msg.sender);

        uint256 remaining = s.amount - _amount;

        // If remaining drops below minimum tier, force full unstake
        uint256 actualUnstake = _amount;
        if (remaining > 0 && remaining < GROWER_MIN) {
            actualUnstake = s.amount;
            remaining = 0;
        }

        // Remove old effective stake
        totalEffectiveStaked -= _effectiveStake(s.amount);

        s.amount = remaining;
        totalStaked -= actualUnstake;
        totalEffectiveStaked += _effectiveStake(remaining);

        // Reset reward debt
        s.rewardDebt = (_effectiveStake(remaining) * accRewardPerShare) / PRECISION;

        sizeToken.safeTransfer(msg.sender, actualUnstake);

        emit Unstaked(msg.sender, actualUnstake, getTier(msg.sender));
    }

    // ──────────────────────────────────────────────────────────────────
    // Core: Claim Rewards
    // ──────────────────────────────────────────────────────────────────

    function claimRewards() external nonReentrant whenNotPaused {
        _settle(msg.sender);

        StakeInfo storage s = stakes[msg.sender];
        uint256 rewards = s.pendingRewards;
        if (rewards == 0) revert NothingToClaim();

        s.pendingRewards = 0;
        s.lastClaimAt = uint64(block.timestamp);

        sizeToken.safeTransfer(msg.sender, rewards);

        emit RewardsClaimed(msg.sender, rewards);
    }

    // ──────────────────────────────────────────────────────────────────
    // Core: Deposit Rewards (from trading fees)
    // ──────────────────────────────────────────────────────────────────

    function depositRewards(uint256 _amount) external nonReentrant onlyDepositor {
        if (_amount == 0) revert ZeroAmount();

        sizeToken.safeTransferFrom(msg.sender, address(this), _amount);

        if (totalEffectiveStaked > 0) {
            accRewardPerShare += (_amount * PRECISION) / totalEffectiveStaked;
        } else {
            bufferedRewards += _amount;
        }

        emit RewardsDeposited(msg.sender, _amount);
    }

    // ──────────────────────────────────────────────────────────────────
    // Emergency: withdraw stake forfeiting unclaimed rewards
    // ──────────────────────────────────────────────────────────────────

    function emergencyWithdraw() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        uint256 amount = s.amount;
        if (amount == 0) revert ZeroAmount();

        totalEffectiveStaked -= _effectiveStake(amount);
        totalStaked -= amount;

        s.amount = 0;
        s.rewardDebt = 0;
        s.pendingRewards = 0;

        sizeToken.safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(msg.sender, amount);
    }

    // ──────────────────────────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────────────────────────

    function getStakeInfo(address _user)
        external
        view
        returns (
            uint256 stakedAmount,
            uint256 pendingRewards,
            uint256 tier,
            uint256 boost,
            uint256 effectiveStake
        )
    {
        StakeInfo storage s = stakes[_user];
        stakedAmount = s.amount;
        tier = _getTier(s.amount);
        boost = _getBoost(s.amount);
        effectiveStake = _effectiveStake(s.amount);

        // Calculate current pending (settled + accrued since last action)
        pendingRewards = s.pendingRewards;
        if (s.amount > 0) {
            uint256 eff = _effectiveStake(s.amount);
            uint256 accrued = (eff * accRewardPerShare) / PRECISION;
            if (accrued > s.rewardDebt) {
                pendingRewards += accrued - s.rewardDebt;
            }
        }
    }

    function getTier(address _user) public view returns (uint256) {
        return _getTier(stakes[_user].amount);
    }

    function getBoost(address _user) external view returns (uint256) {
        return _getBoost(stakes[_user].amount);
    }

    // ──────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────

    function _settle(address _user) internal {
        StakeInfo storage s = stakes[_user];
        if (s.amount == 0) return;

        uint256 eff = _effectiveStake(s.amount);
        uint256 accrued = (eff * accRewardPerShare) / PRECISION;
        if (accrued > s.rewardDebt) {
            s.pendingRewards += accrued - s.rewardDebt;
        }
    }

    function _effectiveStake(uint256 _amount) internal pure returns (uint256) {
        return (_amount * _getBoost(_amount)) / 10_000;
    }

    function _getBoost(uint256 _amount) internal pure returns (uint256) {
        if (_amount >= WHALE_MIN)  return WHALE_BOOST;
        if (_amount >= SHLONG_MIN) return SHLONG_BOOST;
        if (_amount >= SHOWER_MIN) return SHOWER_BOOST;
        if (_amount >= GROWER_MIN) return GROWER_BOOST;
        return 0;
    }

    function _getTier(uint256 _amount) internal pure returns (uint256) {
        if (_amount >= WHALE_MIN)  return 4;
        if (_amount >= SHLONG_MIN) return 3;
        if (_amount >= SHOWER_MIN) return 2;
        if (_amount >= GROWER_MIN) return 1;
        return 0;
    }
}
