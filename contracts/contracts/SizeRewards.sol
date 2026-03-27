// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title SizeRewards
 * @notice Proportional daily reward distribution for SIZE. platform.
 *         Activity weights set by backend, rewards claimed per-epoch.
 */
contract SizeRewards is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable sizeToken;
    address public protocolWallet;
    address public gasWallet;

    uint256 public currentEpoch;
    uint256 public lastDistributionTime;
    uint256 public minDistributionInterval = 23 hours;
    uint256 public pendingRewardPool;

    struct EpochSnapshot {
        uint256 totalPool;
        uint256 totalWeight;
        uint256 timestamp;
        bool finalized;
    }
    mapping(uint256 => EpochSnapshot) public epochs;

    // epoch => user => weight
    mapping(uint256 => mapping(address => uint256)) public userEpochWeight;
    // epoch => user => claimed
    mapping(uint256 => mapping(address => bool)) public epochClaimed;

    mapping(address => bool) public isDistributor;

    event RewardsDeposited(uint256 amount, uint256 epoch);
    event EpochFinalized(uint256 epoch, uint256 totalPool, uint256 totalWeight);
    event UserWeightSet(uint256 epoch, address indexed user, uint256 weight);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 epoch);
    event DistributorUpdated(address indexed distributor, bool status);

    error NotDistributor();
    error EpochNotFinalized();
    error AlreadyClaimed();
    error NothingToClaim();
    error TooSoon();
    error ZeroAmount();
    error ZeroAddress();
    error EpochAlreadyFinalized();
    error ArrayTooLong();

    constructor(address _sizeToken, address _protocolWallet, address _gasWallet) Ownable(msg.sender) {
        if (_sizeToken == address(0) || _protocolWallet == address(0) || _gasWallet == address(0))
            revert ZeroAddress();
        sizeToken = IERC20(_sizeToken);
        protocolWallet = _protocolWallet;
        gasWallet = _gasWallet;
        isDistributor[msg.sender] = true;
    }

    modifier onlyDistributor() {
        if (!isDistributor[msg.sender] && msg.sender != owner()) revert NotDistributor();
        _;
    }

    // ── Admin ────────────────────────────────────────────────────────

    function setDistributor(address _addr, bool _status) external onlyOwner {
        if (_addr == address(0)) revert ZeroAddress();
        isDistributor[_addr] = _status;
        emit DistributorUpdated(_addr, _status);
    }

    function setProtocolWallet(address _wallet) external onlyOwner {
        if (_wallet == address(0)) revert ZeroAddress();
        protocolWallet = _wallet;
    }

    function setGasWallet(address _wallet) external onlyOwner {
        if (_wallet == address(0)) revert ZeroAddress();
        gasWallet = _wallet;
    }

    // ── Deposit rewards ──────────────────────────────────────────────

    function depositRewards(uint256 _amount) external nonReentrant onlyDistributor {
        if (_amount == 0) revert ZeroAmount();
        sizeToken.safeTransferFrom(msg.sender, address(this), _amount);
        pendingRewardPool += _amount;
        emit RewardsDeposited(_amount, currentEpoch);
    }

    // ── Set user weights (only for current unfinalised epoch) ────────

    function setUserWeights(
        address[] calldata _users,
        uint256[] calldata _weights
    ) external onlyDistributor {
        require(_users.length == _weights.length, "Length mismatch");
        if (_users.length > 500) revert ArrayTooLong();

        uint256 epoch = currentEpoch;
        // Cannot set weights for already-finalized epoch
        if (epochs[epoch].finalized) revert EpochAlreadyFinalized();

        for (uint256 i = 0; i < _users.length; i++) {
            userEpochWeight[epoch][_users[i]] = _weights[i];
            emit UserWeightSet(epoch, _users[i], _weights[i]);
        }
    }

    // ── Finalize epoch ───────────────────────────────────────────────

    function finalizeEpoch(uint256 _totalWeight) external onlyDistributor {
        if (lastDistributionTime > 0 && block.timestamp < lastDistributionTime + minDistributionInterval) {
            revert TooSoon();
        }
        if (_totalWeight == 0) revert ZeroAmount();

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

    // ── Claim rewards ────────────────────────────────────────────────

    function claimRewards(uint256 _epoch) external nonReentrant {
        _claimSingle(msg.sender, _epoch);
    }

    function claimMultipleEpochs(uint256[] calldata _epochs) external nonReentrant {
        if (_epochs.length > 100) revert ArrayTooLong();
        uint256 totalReward = 0;

        for (uint256 i = 0; i < _epochs.length; i++) {
            uint256 ep = _epochs[i];
            EpochSnapshot storage snap = epochs[ep];
            if (!snap.finalized) continue;
            if (epochClaimed[ep][msg.sender]) continue;

            uint256 weight = userEpochWeight[ep][msg.sender];
            if (weight == 0) continue;

            uint256 reward = (snap.totalPool * weight) / snap.totalWeight;
            if (reward == 0) continue;

            epochClaimed[ep][msg.sender] = true;
            totalReward += reward;
            emit RewardsClaimed(msg.sender, reward, ep);
        }

        if (totalReward == 0) revert NothingToClaim();
        sizeToken.safeTransfer(msg.sender, totalReward);
    }

    // ── View ─────────────────────────────────────────────────────────

    function getClaimable(address _user, uint256 _epoch) external view returns (uint256) {
        EpochSnapshot storage snap = epochs[_epoch];
        if (!snap.finalized || snap.totalWeight == 0) return 0;
        if (epochClaimed[_epoch][_user]) return 0;
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

    // ── Internal ─────────────────────────────────────────────────────

    function _claimSingle(address _user, uint256 _epoch) internal {
        EpochSnapshot storage snap = epochs[_epoch];
        if (!snap.finalized) revert EpochNotFinalized();
        if (epochClaimed[_epoch][_user]) revert AlreadyClaimed();

        uint256 weight = userEpochWeight[_epoch][_user];
        if (weight == 0) revert NothingToClaim();

        uint256 reward = (snap.totalPool * weight) / snap.totalWeight;
        if (reward == 0) revert NothingToClaim();

        epochClaimed[_epoch][_user] = true;
        sizeToken.safeTransfer(_user, reward);

        emit RewardsClaimed(_user, reward, _epoch);
    }
}
