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

    IERC20 public immutable sizeToken;

    uint256 public constant GROWER_MIN  = 100_000e18;
    uint256 public constant SHOWER_MIN  = 1_000_000e18;
    uint256 public constant SHLONG_MIN  = 10_000_000e18;
    uint256 public constant WHALE_MIN   = 100_000_000e18;

    uint256 public constant GROWER_BOOST  = 10_000;   // 1x
    uint256 public constant SHOWER_BOOST  = 20_000;   // 2x
    uint256 public constant SHLONG_BOOST  = 50_000;   // 5x
    uint256 public constant WHALE_BOOST   = 120_000;  // 12x

    uint256 public constant MAX_PENALTY_BPS = 5000;     // 50% max penalty
    uint256 public constant LOCK_PERIOD     = 365 days;
    uint256 private constant BPS = 10_000;
    uint256 private constant PRECISION = 1e18;

    struct StakeInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint64  firstStakedAt;
        uint64  lastStakedAt;
        uint64  lastClaimAt;
    }

    mapping(address => StakeInfo) public stakes;

    uint256 public totalStaked;
    uint256 public totalEffectiveStaked;
    uint256 public accRewardPerShare;
    uint256 public bufferedRewards;
    uint256 public totalPenaltiesCollected;

    mapping(address => bool) public isDepositor;

    event Staked(address indexed user, uint256 amount, uint256 newTier);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty, uint256 newTier);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(address indexed depositor, uint256 amount);
    event PenaltyRedistributed(address indexed user, uint256 penaltyAmount);
    event EmergencyWithdraw(address indexed user, uint256 amount, uint256 penalty);
    event DepositorUpdated(address indexed depositor, bool status);

    error ZeroAmount();
    error ZeroAddress();
    error BelowMinimumTier(uint256 resultingBalance, uint256 minimum);
    error ExceedsStake(uint256 requested, uint256 staked);
    error NotDepositor();
    error NothingToClaim();

    constructor(address _sizeToken) Ownable(msg.sender) {
        if (_sizeToken == address(0)) revert ZeroAddress();
        sizeToken = IERC20(_sizeToken);
        isDepositor[msg.sender] = true;
    }

    modifier onlyDepositor() {
        if (!isDepositor[msg.sender] && msg.sender != owner())
            revert NotDepositor();
        _;
    }

    function setDepositor(address _depositor, bool _status) external onlyOwner {
        if (_depositor == address(0)) revert ZeroAddress();
        isDepositor[_depositor] = _status;
        emit DepositorUpdated(_depositor, _status);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── Stake ────────────────────────────────────────────────────────

    function stake(uint256 _amount) external nonReentrant whenNotPaused {
        if (_amount == 0) revert ZeroAmount();

        StakeInfo storage s = stakes[msg.sender];
        uint256 newBalance = s.amount + _amount;

        if (newBalance < GROWER_MIN)
            revert BelowMinimumTier(newBalance, GROWER_MIN);

        _settle(msg.sender);

        if (s.amount > 0) {
            totalEffectiveStaked -= _effectiveStake(s.amount);
        }

        s.amount = newBalance;
        totalStaked += _amount;
        totalEffectiveStaked += _effectiveStake(newBalance);
        s.rewardDebt = (_effectiveStake(newBalance) * accRewardPerShare) / PRECISION;

        if (s.firstStakedAt == 0) s.firstStakedAt = uint64(block.timestamp);
        s.lastStakedAt = uint64(block.timestamp);

        if (bufferedRewards > 0 && totalEffectiveStaked > 0) {
            accRewardPerShare += (bufferedRewards * PRECISION) / totalEffectiveStaked;
            s.rewardDebt = (_effectiveStake(newBalance) * accRewardPerShare) / PRECISION;
            bufferedRewards = 0;
        }

        sizeToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount, getTier(msg.sender));
    }

    // ── Unstake (with early withdrawal penalty) ──────────────────────

    function unstake(uint256 _amount) external nonReentrant whenNotPaused {
        StakeInfo storage s = stakes[msg.sender];
        if (_amount == 0) revert ZeroAmount();
        if (_amount > s.amount) revert ExceedsStake(_amount, s.amount);

        // Settle and auto-claim pending rewards first
        _settle(msg.sender);
        uint256 pendingReward = s.pendingRewards;
        s.pendingRewards = 0;

        uint256 remaining = s.amount - _amount;

        if (remaining > 0 && remaining < GROWER_MIN)
            revert BelowMinimumTier(remaining, GROWER_MIN);

        // Calculate early withdrawal penalty on principal only
        uint256 penaltyBps = _getPenaltyBps(s.lastStakedAt);
        uint256 penalty = (_amount * penaltyBps) / BPS;
        uint256 principalOut = _amount - penalty;

        totalEffectiveStaked -= _effectiveStake(s.amount);
        s.amount = remaining;
        totalStaked -= _amount;
        totalEffectiveStaked += _effectiveStake(remaining);
        s.rewardDebt = (_effectiveStake(remaining) * accRewardPerShare) / PRECISION;

        // Transfer principal (minus penalty) + any accrued rewards
        uint256 totalOut = principalOut + pendingReward;
        if (totalOut > 0) {
            sizeToken.safeTransfer(msg.sender, totalOut);
        }

        // Redistribute penalty to remaining stakers
        if (penalty > 0) {
            totalPenaltiesCollected += penalty;
            if (totalEffectiveStaked > 0) {
                accRewardPerShare += (penalty * PRECISION) / totalEffectiveStaked;
                emit PenaltyRedistributed(msg.sender, penalty);
            } else {
                bufferedRewards += penalty;
            }
        }

        if (pendingReward > 0) {
            s.lastClaimAt = uint64(block.timestamp);
            emit RewardsClaimed(msg.sender, pendingReward);
        }
        emit Unstaked(msg.sender, principalOut, penalty, getTier(msg.sender));
    }

    // ── Claim Rewards ────────────────────────────────────────────────

    function claimRewards() external nonReentrant whenNotPaused {
        _settle(msg.sender);

        StakeInfo storage s = stakes[msg.sender];
        uint256 rewards = s.pendingRewards;
        if (rewards == 0) revert NothingToClaim();

        s.pendingRewards = 0;
        s.rewardDebt = (_effectiveStake(s.amount) * accRewardPerShare) / PRECISION;
        s.lastClaimAt = uint64(block.timestamp);

        sizeToken.safeTransfer(msg.sender, rewards);

        emit RewardsClaimed(msg.sender, rewards);
    }

    // ── Deposit Rewards (from trading fees) ──────────────────────────

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

    // ── Emergency withdraw (penalty still applies, rewards forfeited) ─

    function emergencyWithdraw() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        uint256 amount = s.amount;
        if (amount == 0) revert ZeroAmount();

        uint256 penaltyBps = _getPenaltyBps(s.lastStakedAt);
        uint256 penalty = (amount * penaltyBps) / BPS;
        uint256 userReceives = amount - penalty;

        totalEffectiveStaked -= _effectiveStake(amount);
        totalStaked -= amount;

        s.amount = 0;
        s.rewardDebt = 0;
        s.pendingRewards = 0;

        if (userReceives > 0) {
            sizeToken.safeTransfer(msg.sender, userReceives);
        }

        if (penalty > 0) {
            totalPenaltiesCollected += penalty;
            if (totalEffectiveStaked > 0) {
                accRewardPerShare += (penalty * PRECISION) / totalEffectiveStaked;
            } else {
                bufferedRewards += penalty;
            }
        }

        emit EmergencyWithdraw(msg.sender, userReceives, penalty);
    }

    // ── View functions ───────────────────────────────────────────────

    function getStakeInfo(address _user) external view returns (
        uint256 stakedAmount, uint256 pendingRewards, uint256 tier,
        uint256 boost, uint256 effectiveStake
    ) {
        StakeInfo storage s = stakes[_user];
        stakedAmount = s.amount;
        tier = _getTier(s.amount);
        boost = _getBoost(s.amount);
        effectiveStake = _effectiveStake(s.amount);

        pendingRewards = s.pendingRewards;
        if (s.amount > 0) {
            uint256 eff = _effectiveStake(s.amount);
            uint256 accrued = (eff * accRewardPerShare) / PRECISION;
            if (accrued > s.rewardDebt) {
                pendingRewards += accrued - s.rewardDebt;
            }
        }
    }

    function getEarlyWithdrawalPenalty(address _user) external view returns (
        uint256 penaltyBps, uint256 penaltyPct, uint256 daysStaked, uint256 daysRemaining
    ) {
        StakeInfo storage s = stakes[_user];
        if (s.lastStakedAt == 0) return (0, 0, 0, 0);

        uint256 elapsed = block.timestamp - s.lastStakedAt;
        daysStaked = elapsed / 1 days;
        penaltyBps = _getPenaltyBps(s.lastStakedAt);
        penaltyPct = (penaltyBps * 100) / BPS;
        daysRemaining = elapsed >= LOCK_PERIOD ? 0 : (LOCK_PERIOD - elapsed) / 1 days;
    }

    function previewUnstake(address _user, uint256 _amount) external view returns (
        uint256 userReceives, uint256 penalty, uint256 penaltyBps
    ) {
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

    // ── Internal ─────────────────────────────────────────────────────

    function _settle(address _user) internal {
        StakeInfo storage s = stakes[_user];
        if (s.amount == 0) return;

        uint256 eff = _effectiveStake(s.amount);
        uint256 accrued = (eff * accRewardPerShare) / PRECISION;
        if (accrued > s.rewardDebt) {
            s.pendingRewards += accrued - s.rewardDebt;
        }
        s.rewardDebt = accrued;
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

    /// @dev Cubic decay: 50% × (remaining / 365 days)³
    function _getPenaltyBps(uint64 _stakedAt) internal view returns (uint256) {
        if (_stakedAt == 0) return 0;
        uint256 elapsed = block.timestamp - _stakedAt;
        if (elapsed >= LOCK_PERIOD) return 0;

        uint256 remaining = LOCK_PERIOD - elapsed;
        uint256 ratio = (remaining * 1e18) / LOCK_PERIOD;
        uint256 cubed = (ratio * ratio / 1e18) * ratio / 1e18;
        return (cubed * MAX_PENALTY_BPS) / 1e18;
    }
}
