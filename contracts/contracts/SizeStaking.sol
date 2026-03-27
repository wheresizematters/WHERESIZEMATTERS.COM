// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
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
 *
 *         Early Withdrawal Penalty:
 *           Cubic decay from 50% at day 0 to 0% at 365 days.
 *           penalty = 50% × (daysRemaining / 365)³
 *           Penalized tokens are redistributed to loyal stakers.
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

    // Early withdrawal penalty
    uint256 public constant MAX_PENALTY_BPS = 5000;     // 50% max penalty
    uint256 public constant LOCK_PERIOD     = 365 days; // 0% penalty after 1 year
    uint256 private constant BPS = 10_000;

    uint256 private constant PRECISION = 1e18;

    // ──────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────

    struct StakeInfo {
        uint256 amount;          // raw tokens staked
        uint256 rewardDebt;      // accRewardPerShare snapshot × effective stake
        uint256 pendingRewards;  // claimable but unclaimed
        uint64  firstStakedAt;   // timestamp of very first stake (never overwritten)
        uint64  lastStakedAt;    // timestamp of most recent stake action
        uint64  lastClaimAt;     // timestamp of last claim
    }

    mapping(address => StakeInfo) public stakes;

    uint256 public totalStaked;
    uint256 public totalEffectiveStaked;
    uint256 public accRewardPerShare;   // scaled by PRECISION
    uint256 public bufferedRewards;     // rewards deposited when no stakers
    uint256 public totalPenaltiesCollected; // lifetime penalties redistributed

    // Authorised fee depositors (owner + approved bots)
    mapping(address => bool) public isDepositor;

    // ──────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 newTier);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty, uint256 newTier);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(address indexed depositor, uint256 amount);
    event PenaltyRedistributed(address indexed user, uint256 penaltyAmount);
    event EmergencyWithdraw(address indexed user, uint256 amount, uint256 penalty);
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
        if (s.firstStakedAt == 0) s.firstStakedAt = uint64(block.timestamp);
        s.lastStakedAt = uint64(block.timestamp);

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
    // Core: Unstake (with early withdrawal penalty)
    // ──────────────────────────────────────────────────────────────────

    function unstake(uint256 _amount) external nonReentrant whenNotPaused {
        StakeInfo storage s = stakes[msg.sender];
        if (_amount == 0) revert ZeroAmount();
        if (_amount > s.amount) revert ExceedsStake(_amount, s.amount);

        // Settle pending rewards
        _settle(msg.sender);

        uint256 remaining = s.amount - _amount;

        // Revert if remaining balance would be below minimum tier
        // User must unstake fully if they want to drop below GROWER_MIN
        if (remaining > 0 && remaining < GROWER_MIN)
            revert BelowMinimumTier(remaining, GROWER_MIN);

        // Calculate early withdrawal penalty
        uint256 penaltyBps = _getPenaltyBps(s.lastStakedAt);
        uint256 penalty = (_amount * penaltyBps) / BPS;
        uint256 userReceives = _amount - penalty;

        // Remove old effective stake
        totalEffectiveStaked -= _effectiveStake(s.amount);

        s.amount = remaining;
        totalStaked -= _amount;
        totalEffectiveStaked += _effectiveStake(remaining);

        // Reset reward debt
        s.rewardDebt = (_effectiveStake(remaining) * accRewardPerShare) / PRECISION;

        // Send user their tokens minus penalty
        sizeToken.safeTransfer(msg.sender, userReceives);

        // Redistribute penalty to remaining stakers
        if (penalty > 0 && totalEffectiveStaked > 0) {
            accRewardPerShare += (penalty * PRECISION) / totalEffectiveStaked;
            totalPenaltiesCollected += penalty;
            emit PenaltyRedistributed(msg.sender, penalty);
        } else if (penalty > 0) {
            // No stakers left — buffer it
            bufferedRewards += penalty;
            totalPenaltiesCollected += penalty;
        }

        emit Unstaked(msg.sender, userReceives, penalty, getTier(msg.sender));
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
    // Emergency: withdraw stake (penalty still applies)
    // ──────────────────────────────────────────────────────────────────

    function emergencyWithdraw() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        uint256 amount = s.amount;
        if (amount == 0) revert ZeroAmount();

        // Penalty still applies on emergency withdraw
        uint256 penaltyBps = _getPenaltyBps(s.lastStakedAt);
        uint256 penalty = (amount * penaltyBps) / BPS;
        uint256 userReceives = amount - penalty;

        totalEffectiveStaked -= _effectiveStake(amount);
        totalStaked -= amount;

        s.amount = 0;
        s.rewardDebt = 0;
        s.pendingRewards = 0;

        sizeToken.safeTransfer(msg.sender, userReceives);

        // Redistribute penalty
        if (penalty > 0 && totalEffectiveStaked > 0) {
            accRewardPerShare += (penalty * PRECISION) / totalEffectiveStaked;
            totalPenaltiesCollected += penalty;
        } else if (penalty > 0) {
            bufferedRewards += penalty;
            totalPenaltiesCollected += penalty;
        }

        emit EmergencyWithdraw(msg.sender, userReceives, penalty);
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

    /// @notice Get the current early withdrawal penalty in basis points for a user
    function getEarlyWithdrawalPenalty(address _user) external view returns (uint256 penaltyBps, uint256 penaltyPct, uint256 daysStaked, uint256 daysRemaining) {
        StakeInfo storage s = stakes[_user];
        if (s.lastStakedAt == 0) return (0, 0, 0, 0);

        uint256 elapsed = block.timestamp - s.lastStakedAt;
        daysStaked = elapsed / 1 days;
        penaltyBps = _getPenaltyBps(s.lastStakedAt);
        penaltyPct = (penaltyBps * 100) / BPS; // e.g. 2500 bps = 25%

        if (elapsed >= LOCK_PERIOD) {
            daysRemaining = 0;
        } else {
            daysRemaining = (LOCK_PERIOD - elapsed) / 1 days;
        }
    }

    /// @notice Preview how much a user would receive if they unstaked now
    function previewUnstake(address _user, uint256 _amount) external view returns (uint256 userReceives, uint256 penalty, uint256 penaltyBps) {
        StakeInfo storage s = stakes[_user];
        if (_amount > s.amount) _amount = s.amount;
        penaltyBps = _getPenaltyBps(s.lastStakedAt);
        penalty = (_amount * penaltyBps) / BPS;
        userReceives = _amount - penalty;
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

    /// @dev Cubic decay penalty: 50% × (remaining / 365 days)³
    ///      Frontloaded — drops fast early, flattens near the end.
    ///      Day 0: 50% | 3mo: 21% | 6mo: 6.25% | 9mo: 0.78% | 12mo: 0%
    function _getPenaltyBps(uint64 _stakedAt) internal view returns (uint256) {
        if (_stakedAt == 0) return 0;
        uint256 elapsed = block.timestamp - _stakedAt;
        if (elapsed >= LOCK_PERIOD) return 0;

        uint256 remaining = LOCK_PERIOD - elapsed;

        // Cubic: (remaining/LOCK_PERIOD)³ × MAX_PENALTY_BPS
        // Use fixed-point: scale to 1e18 to avoid truncation
        uint256 ratio = (remaining * 1e18) / LOCK_PERIOD;       // 0 to 1e18
        uint256 cubed = (ratio * ratio / 1e18) * ratio / 1e18;  // ratio³ in 1e18
        return (cubed * MAX_PENALTY_BPS) / 1e18;
    }
}
