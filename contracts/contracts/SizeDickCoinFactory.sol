// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SizeDickCoinFactory
 * @notice Manages fee collection and distribution for all DickCoins
 *         launched through the SIZE. platform.
 *
 *         Fee flow:
 *         1. DickCoin trades on Uniswap V4 (via Clanker)
 *         2. Clanker sends fee ETH to this contract
 *         3. This contract splits fees:
 *            - 90% to DickCoin creator
 *            - 8% to protocol treasury
 *            - 2% to gas wallet (subsidizes user transactions)
 *
 *         The gas wallet is used by the backend to pay for:
 *         - User reward claims
 *         - Autostaking contract deployments
 *         - Fee distribution transactions
 */
contract SizeDickCoinFactory is Ownable2Step, ReentrancyGuard {

    // ── Fee split (basis points, 10000 = 100%) ─────────────────────
    uint256 public constant CREATOR_BPS = 9000;    // 90%
    uint256 public constant PROTOCOL_BPS = 800;    // 8%
    uint256 public constant GAS_BPS = 200;         // 2%
    uint256 public constant TOTAL_BPS = 10000;

    // ── Wallets ────────────────────────────────────────────────────
    address public protocolWallet;
    address public gasWallet;

    // ── DickCoin registry ──────────────────────────────────────────
    struct DickCoinInfo {
        address creator;           // wallet that launched it
        address tokenAddress;      // ERC-20 contract on Base
        uint256 totalFeesReceived; // total ETH fees received
        uint256 creatorPaid;       // total ETH paid to creator
        uint256 stakingDeployed;   // timestamp when autostaking deployed (0 = not yet)
        bool active;
    }

    mapping(address => DickCoinInfo) public dickCoins;  // tokenAddress => info
    address[] public allDickCoins;

    // Autostaking threshold
    uint256 public autoStakeThreshold = 0.5 ether;

    // ── Events ─────────────────────────────────────────────────────
    event DickCoinRegistered(address indexed tokenAddress, address indexed creator);
    event FeesReceived(address indexed tokenAddress, uint256 amount);
    event FeesSplit(address indexed tokenAddress, uint256 creatorAmount, uint256 protocolAmount, uint256 gasAmount);
    event CreatorPaid(address indexed creator, uint256 amount);
    event AutoStakeThresholdReached(address indexed tokenAddress, uint256 totalFees);
    event ProtocolWalletUpdated(address oldWallet, address newWallet);
    event GasWalletUpdated(address oldWallet, address newWallet);

    // ── Errors ─────────────────────────────────────────────────────
    error ZeroAddress();
    error AlreadyRegistered();
    error NotRegistered();
    error TransferFailed();

    // ── Constructor ────────────────────────────────────────────────
    constructor(address _protocolWallet, address _gasWallet) Ownable(msg.sender) {
        if (_protocolWallet == address(0) || _gasWallet == address(0)) revert ZeroAddress();
        protocolWallet = _protocolWallet;
        gasWallet = _gasWallet;
    }

    // ── Admin ──────────────────────────────────────────────────────

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

    // ── Register a new DickCoin ────────────────────────────────────

    function registerDickCoin(address _tokenAddress, address _creator) external onlyOwner {
        if (_tokenAddress == address(0) || _creator == address(0)) revert ZeroAddress();
        if (dickCoins[_tokenAddress].active) revert AlreadyRegistered();

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

    // ── Receive and split fees ─────────────────────────────────────

    /**
     * @notice Receive ETH fees for a specific DickCoin and split them.
     *         Called by the fee collector bot after claiming from Clanker.
     */
    function distributeFees(address _tokenAddress) external payable nonReentrant {
        DickCoinInfo storage info = dickCoins[_tokenAddress];
        if (!info.active) revert NotRegistered();

        uint256 amount = msg.value;
        info.totalFeesReceived += amount;

        // Split
        uint256 creatorAmount = (amount * CREATOR_BPS) / TOTAL_BPS;
        uint256 protocolAmount = (amount * PROTOCOL_BPS) / TOTAL_BPS;
        uint256 gasAmount = amount - creatorAmount - protocolAmount; // remainder to gas (handles rounding)

        // Transfer to creator
        (bool s1, ) = payable(info.creator).call{value: creatorAmount}("");
        if (!s1) revert TransferFailed();
        info.creatorPaid += creatorAmount;

        // Transfer to protocol
        (bool s2, ) = payable(protocolWallet).call{value: protocolAmount}("");
        if (!s2) revert TransferFailed();

        // Transfer to gas wallet
        (bool s3, ) = payable(gasWallet).call{value: gasAmount}("");
        if (!s3) revert TransferFailed();

        emit FeesReceived(_tokenAddress, amount);
        emit FeesSplit(_tokenAddress, creatorAmount, protocolAmount, gasAmount);
        emit CreatorPaid(info.creator, creatorAmount);

        // Check autostaking threshold
        if (info.stakingDeployed == 0 && info.totalFeesReceived >= autoStakeThreshold) {
            info.stakingDeployed = block.timestamp;
            emit AutoStakeThresholdReached(_tokenAddress, info.totalFeesReceived);
        }
    }

    // ── View functions ─────────────────────────────────────────────

    function getDickCoinCount() external view returns (uint256) {
        return allDickCoins.length;
    }

    function getDickCoinInfo(address _tokenAddress) external view returns (
        address creator,
        uint256 totalFeesReceived,
        uint256 creatorPaid,
        bool stakingActive,
        bool active
    ) {
        DickCoinInfo storage info = dickCoins[_tokenAddress];
        return (
            info.creator,
            info.totalFeesReceived,
            info.creatorPaid,
            info.stakingDeployed > 0,
            info.active
        );
    }

    function isAutoStakeReady(address _tokenAddress) external view returns (bool) {
        DickCoinInfo storage info = dickCoins[_tokenAddress];
        return info.active && info.stakingDeployed == 0 && info.totalFeesReceived >= autoStakeThreshold;
    }

    // ── Fallback ───────────────────────────────────────────────────

    receive() external payable {
        // Accept ETH directly — can be distributed later via distributeFees
    }
}
