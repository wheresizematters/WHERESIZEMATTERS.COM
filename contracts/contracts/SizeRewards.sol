// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title SizeRewards
 * @notice Proportional daily reward distribution for SIZE. platform.
 *
 *         The protocol deposits ETH revenue daily. This contract converts
 *         a portion to $SIZE and distributes to users proportionally based
 *         on their activity weight.
 *
 *         Activity weights (set by backend, verified on-chain):
 *         - Verify:  0.001%  of daily pool (10 bps)
 *         - Refer:   0.0008% of daily pool (8 bps)
 *         - Upvote:  0.0005% of daily pool (5 bps)
 *         - Post:    0.0003% of daily pool (3 bps)
 *         - Login:   0.0001% of daily pool (1 bp)
 *         - Message: 0.0001% of daily pool (1 bp)
 *
 *         Each user's reward = (their total weight / total weight of all
 *         users that day) * daily reward pool
 *
 *         Daily caps prevent sybil farming.
 */
contract SizeRewards is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable sizeToken;
    address public protocolWallet;
    address public gasWallet;

    // Daily epoch tracking
    uint256 public currentEpoch;           // increments each distribution
    uint256 public lastDistributionTime;
    uint256 public minDistributionInterval = 23 hours;

    // Reward pool for current epoch
    uint256 public pendingRewardPool;      // $SIZE tokens waiting to be distributed

    // User claims
    struct UserReward {
        uint256 lastClaimedEpoch;
        uint256 pendingClaim;              // $SIZE tokens claimable
    }
    mapping(address => UserReward) public userRewards;

    // Epoch snapshots (set by backend after computing proportional rewards)
    struct EpochSnapshot {
        uint256 totalPool;                 // total $SIZE distributed this epoch
        uint256 totalWeight;               // sum of all user weights
        uint256 timestamp;
        bool finalized;
    }
    mapping(uint256 => EpochSnapshot) public epochs;

    // User epoch weights (set by authorized distributor)
    // epoch => user => weight
    mapping(uint256 => mapping(address => uint256)) public userEpochWeight;

    // Authorized distributors (backend bots)
    mapping(address => bool) public isDistributor;

    // ── Events ─────────────────────────────────────────────────────
    event RewardsDeposited(uint256 amount, uint256 epoch);
    event EpochFinalized(uint256 epoch, uint256 totalPool, uint256 totalWeight);
    event UserWeightSet(uint256 epoch, address indexed user, uint256 weight);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 epoch);
    event DistributorUpdated(address indexed distributor, bool status);

    // ── Errors ─────────────────────────────────────────────────────
    error NotDistributor();
    error EpochNotFinalized();
    error AlreadyClaimed();
    error NothingToClaim();
    error TooSoon();
    error ZeroAmount();

    constructor(address _sizeToken, address _protocolWallet, address _gasWallet) Ownable(msg.sender) {
        sizeToken = IERC20(_sizeToken);
        protocolWallet = _protocolWallet;
        gasWallet = _gasWallet;
        isDistributor[msg.sender] = true;
    }

    modifier onlyDistributor() {
        if (!isDistributor[msg.sender] && msg.sender != owner()) revert NotDistributor();
        _;
    }

    // ── Admin ──────────────────────────────────────────────────────

    function setDistributor(address _addr, bool _status) external onlyOwner {
        isDistributor[_addr] = _status;
        emit DistributorUpdated(_addr, _status);
    }

    function setProtocolWallet(address _wallet) external onlyOwner {
        protocolWallet = _wallet;
    }

    function setGasWallet(address _wallet) external onlyOwner {
        gasWallet = _wallet;
    }

    // ── Deposit rewards into pool ──────────────────────────────────

    function depositRewards(uint256 _amount) external nonReentrant onlyDistributor {
        if (_amount == 0) revert ZeroAmount();
        sizeToken.safeTransferFrom(msg.sender, address(this), _amount);
        pendingRewardPool += _amount;
        emit RewardsDeposited(_amount, currentEpoch);
    }

    // ── Set user weights for current epoch (called by backend) ─────

    function setUserWeights(
        address[] calldata _users,
        uint256[] calldata _weights
    ) external onlyDistributor {
        require(_users.length == _weights.length, "Length mismatch");
        uint256 epoch = currentEpoch;
        for (uint256 i = 0; i < _users.length; i++) {
            userEpochWeight[epoch][_users[i]] = _weights[i];
            emit UserWeightSet(epoch, _users[i], _weights[i]);
        }
    }

    // ── Finalize epoch and distribute ──────────────────────────────

    function finalizeEpoch(uint256 _totalWeight) external onlyDistributor {
        if (lastDistributionTime > 0 && block.timestamp < lastDistributionTime + minDistributionInterval) {
            revert TooSoon();
        }

        uint256 epoch = currentEpoch;
        uint256 pool = pendingRewardPool;

        epochs[epoch] = EpochSnapshot({
            totalPool: pool,
            totalWeight: _totalWeight,
            timestamp: block.timestamp,
            finalized: true
        });

        pendingRewardPool = 0;
        lastDistributionTime = block.timestamp;
        currentEpoch = epoch + 1;

        emit EpochFinalized(epoch, pool, _totalWeight);
    }

    // ── Claim rewards (users call this, gas paid by gas wallet) ────

    function claimRewards(uint256 _epoch) external nonReentrant {
        EpochSnapshot storage snap = epochs[_epoch];
        if (!snap.finalized) revert EpochNotFinalized();

        uint256 weight = userEpochWeight[_epoch][msg.sender];
        if (weight == 0) revert NothingToClaim();

        UserReward storage ur = userRewards[msg.sender];
        // Prevent double claim for same epoch
        if (ur.lastClaimedEpoch > _epoch) revert AlreadyClaimed();

        uint256 reward = (snap.totalPool * weight) / snap.totalWeight;
        if (reward == 0) revert NothingToClaim();

        ur.lastClaimedEpoch = _epoch;
        sizeToken.safeTransfer(msg.sender, reward);

        emit RewardsClaimed(msg.sender, reward, _epoch);
    }

    // ── Batch claim multiple epochs ────────────────────────────────

    function claimMultipleEpochs(uint256[] calldata _epochs) external nonReentrant {
        uint256 totalReward = 0;
        UserReward storage ur = userRewards[msg.sender];

        for (uint256 i = 0; i < _epochs.length; i++) {
            uint256 ep = _epochs[i];
            EpochSnapshot storage snap = epochs[ep];
            if (!snap.finalized) continue;

            uint256 weight = userEpochWeight[ep][msg.sender];
            if (weight == 0) continue;
            if (ur.lastClaimedEpoch > ep) continue;

            uint256 reward = (snap.totalPool * weight) / snap.totalWeight;
            totalReward += reward;
            ur.lastClaimedEpoch = ep;
        }

        if (totalReward == 0) revert NothingToClaim();
        sizeToken.safeTransfer(msg.sender, totalReward);

        emit RewardsClaimed(msg.sender, totalReward, _epochs[_epochs.length - 1]);
    }

    // ── View ───────────────────────────────────────────────────────

    function getClaimable(address _user, uint256 _epoch) external view returns (uint256) {
        EpochSnapshot storage snap = epochs[_epoch];
        if (!snap.finalized || snap.totalWeight == 0) return 0;
        uint256 weight = userEpochWeight[_epoch][_user];
        return (snap.totalPool * weight) / snap.totalWeight;
    }

    function getCurrentEpochInfo() external view returns (
        uint256 epoch, uint256 pool, uint256 lastDist, uint256 nextDist
    ) {
        return (
            currentEpoch,
            pendingRewardPool,
            lastDistributionTime,
            lastDistributionTime + minDistributionInterval
        );
    }
}
