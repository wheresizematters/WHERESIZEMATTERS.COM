// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SizeGifting
 * @notice On-chain $SIZE gifting — send tokens to other users or tip posts.
 *         All transfers are direct ERC-20 transfers with metadata events
 *         that the backend indexes for display.
 *
 *         No fees on gifting — it's a social feature, not a revenue source.
 *         The protocol earns from trading fees, not from gifts.
 */
contract SizeGifting is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable sizeToken;

    // ── Events (indexed by backend for display) ────────────────────
    event Gift(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 postId,        // optional — bytes32(0) if profile-to-profile
        string message         // optional — max 140 chars
    );

    event PostTip(
        address indexed from,
        address indexed postAuthor,
        uint256 amount,
        bytes32 postId
    );

    // ── Errors ─────────────────────────────────────────────────────
    error ZeroAmount();
    error SelfGift();
    error MessageTooLong();

    constructor(address _sizeToken) {
        sizeToken = IERC20(_sizeToken);
    }

    /**
     * @notice Gift $SIZE to another user's wallet
     * @param _to Recipient wallet address
     * @param _amount Amount in wei (18 decimals)
     * @param _postId Optional post ID (bytes32(0) for profile gift)
     * @param _message Optional message (max 140 chars, empty string ok)
     */
    function gift(
        address _to,
        uint256 _amount,
        bytes32 _postId,
        string calldata _message
    ) external nonReentrant {
        if (_amount == 0) revert ZeroAmount();
        if (_to == msg.sender) revert SelfGift();
        if (bytes(_message).length > 140) revert MessageTooLong();

        sizeToken.safeTransferFrom(msg.sender, _to, _amount);

        emit Gift(msg.sender, _to, _amount, _postId, _message);

        if (_postId != bytes32(0)) {
            emit PostTip(msg.sender, _to, _amount, _postId);
        }
    }

    /**
     * @notice Batch gift to multiple recipients (e.g. rain on a thread)
     */
    function batchGift(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external nonReentrant {
        require(_recipients.length == _amounts.length, "Length mismatch");

        uint256 total = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] == 0) revert ZeroAmount();
            if (_recipients[i] == msg.sender) revert SelfGift();
            total += _amounts[i];
        }

        // Transfer total from sender to this contract first
        sizeToken.safeTransferFrom(msg.sender, address(this), total);

        // Then distribute
        for (uint256 i = 0; i < _recipients.length; i++) {
            sizeToken.safeTransfer(_recipients[i], _amounts[i]);
            emit Gift(msg.sender, _recipients[i], _amounts[i], bytes32(0), "");
        }
    }
}
