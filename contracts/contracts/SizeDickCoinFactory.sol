// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SizeDickCoinFactory
 * @notice Manages fee collection and distribution for all DickCoins
 *         launched through the SIZE. platform.
 *
 *         Fee split: 90% creator / 8% protocol / 2% gas wallet
 *
 *         Uses pull-pattern for failed transfers to prevent DOS.
 */
contract SizeDickCoinFactory is Ownable2Step, ReentrancyGuard {

    uint256 public constant CREATOR_BPS = 9000;    // 90%
    uint256 public constant PROTOCOL_BPS = 990;    // 9.9%
    uint256 public constant GAS_BPS = 10;          // 0.1%
    uint256 public constant TOTAL_BPS = 10000;
    uint256 public constant MAX_DICKCOINS = 10000;

    address public protocolWallet;
    address public gasWallet;

    struct DickCoinInfo {
        address creator;
        address tokenAddress;
        uint256 totalFeesReceived;
        uint256 creatorPaid;
        uint256 stakingDeployed;
        bool active;
    }

    mapping(address => DickCoinInfo) public dickCoins;
    address[] public allDickCoins;

    // Pull-pattern: failed transfers accumulate here
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public autoStakeThreshold = 0.5 ether;

    event DickCoinRegistered(address indexed tokenAddress, address indexed creator);
    event FeesReceived(address indexed tokenAddress, uint256 amount);
    event FeesSplit(address indexed tokenAddress, uint256 creatorAmount, uint256 protocolAmount, uint256 gasAmount);
    event CreatorPaid(address indexed creator, uint256 amount);
    event AutoStakeThresholdReached(address indexed tokenAddress, uint256 totalFees);
    event ProtocolWalletUpdated(address oldWallet, address newWallet);
    event GasWalletUpdated(address oldWallet, address newWallet);
    event WithdrawalPending(address indexed recipient, uint256 amount);

    error ZeroAddress();
    error AlreadyRegistered();
    error NotRegistered();
    error ZeroAmount();
    error TooManyCoins();
    error NothingToWithdraw();

    constructor(address _protocolWallet, address _gasWallet) Ownable(msg.sender) {
        if (_protocolWallet == address(0) || _gasWallet == address(0)) revert ZeroAddress();
        protocolWallet = _protocolWallet;
        gasWallet = _gasWallet;
    }

    // ── Admin ────────────────────────────────────────────────────────

    function setProtocolWallet(address _wallet) external onlyOwner {
        if (_wallet == address(0)) revert ZeroAddress();
        emit ProtocolWalletUpdated(protocolWallet, _wallet);
        protocolWallet = _wallet;
    }

    function setGasWallet(address _wallet) external onlyOwner {
        if (_wallet == address(0)) revert ZeroAddress();
        emit GasWalletUpdated(gasWallet, _wallet);
        gasWallet = _wallet;
    }

    function setAutoStakeThreshold(uint256 _threshold) external onlyOwner {
        autoStakeThreshold = _threshold;
    }

    // ── Register ─────────────────────────────────────────────────────

    function registerDickCoin(address _tokenAddress, address _creator) external onlyOwner {
        if (_tokenAddress == address(0) || _creator == address(0)) revert ZeroAddress();
        if (dickCoins[_tokenAddress].active) revert AlreadyRegistered();
        if (allDickCoins.length >= MAX_DICKCOINS) revert TooManyCoins();

        dickCoins[_tokenAddress] = DickCoinInfo({
            creator: _creator,
            tokenAddress: _tokenAddress,
            totalFeesReceived: 0,
            creatorPaid: 0,
            stakingDeployed: 0,
            active: true
        });

        allDickCoins.push(_tokenAddress);
        emit DickCoinRegistered(_tokenAddress, _creator);
    }

    // ── Distribute fees (pull-pattern safe) ──────────────────────────

    function distributeFees(address _tokenAddress) external payable nonReentrant {
        DickCoinInfo storage info = dickCoins[_tokenAddress];
        if (!info.active) revert NotRegistered();
        if (msg.value == 0) revert ZeroAmount();

        uint256 amount = msg.value;
        info.totalFeesReceived += amount;

        uint256 creatorAmount = (amount * CREATOR_BPS) / TOTAL_BPS;
        uint256 protocolAmount = (amount * PROTOCOL_BPS) / TOTAL_BPS;
        uint256 gasAmount = amount - creatorAmount - protocolAmount;

        // Use pull-pattern: try transfer, if fails credit pendingWithdrawals
        _safeSendETH(info.creator, creatorAmount);
        info.creatorPaid += creatorAmount;

        _safeSendETH(protocolWallet, protocolAmount);
        _safeSendETH(gasWallet, gasAmount);

        emit FeesReceived(_tokenAddress, amount);
        emit FeesSplit(_tokenAddress, creatorAmount, protocolAmount, gasAmount);
        emit CreatorPaid(info.creator, creatorAmount);

        if (info.stakingDeployed == 0 && info.totalFeesReceived >= autoStakeThreshold) {
            info.stakingDeployed = block.timestamp;
            emit AutoStakeThresholdReached(_tokenAddress, info.totalFeesReceived);
        }
    }

    /// @notice Withdraw pending ETH from failed transfers
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            // Re-credit if still failing
            pendingWithdrawals[msg.sender] = amount;
        }
    }

    // ── View ─────────────────────────────────────────────────────────

    function getDickCoinCount() external view returns (uint256) {
        return allDickCoins.length;
    }

    function getDickCoinInfo(address _tokenAddress) external view returns (
        address creator, uint256 totalFeesReceived, uint256 creatorPaid,
        bool stakingActive, bool active
    ) {
        DickCoinInfo storage info = dickCoins[_tokenAddress];
        return (info.creator, info.totalFeesReceived, info.creatorPaid, info.stakingDeployed > 0, info.active);
    }

    function isAutoStakeReady(address _tokenAddress) external view returns (bool) {
        DickCoinInfo storage info = dickCoins[_tokenAddress];
        return info.active && info.stakingDeployed == 0 && info.totalFeesReceived >= autoStakeThreshold;
    }

    // ── Internal ─────────────────────────────────────────────────────

    function _safeSendETH(address _to, uint256 _amount) internal {
        if (_amount == 0) return;
        (bool success, ) = payable(_to).call{value: _amount, gas: 30000}("");
        if (!success) {
            pendingWithdrawals[_to] += _amount;
            emit WithdrawalPending(_to, _amount);
        }
    }

    receive() external payable {}
}
