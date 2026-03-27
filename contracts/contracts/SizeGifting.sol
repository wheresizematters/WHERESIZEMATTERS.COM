// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SizeGifting
 * @notice On-chain $SIZE gifting — send tokens to other users or tip posts.
 *         No fees on gifting — social feature, not revenue source.
 */
contract SizeGifting is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable sizeToken;
    uint256 public constant MAX_BATCH = 100;

    event Gift(address indexed from, address indexed to, uint256 amount, bytes32 postId, string message);
    event PostTip(address indexed from, address indexed postAuthor, uint256 amount, bytes32 postId);

    error ZeroAmount();
    error ZeroAddress();
    error SelfGift();
    error MessageTooLong();
    error BatchTooLarge();

    constructor(address _sizeToken) {
        if (_sizeToken == address(0)) revert ZeroAddress();
        sizeToken = IERC20(_sizeToken);
    }

    function gift(
        address _to,
        uint256 _amount,
        bytes32 _postId,
        string calldata _message
    ) external nonReentrant {
        if (_amount == 0) revert ZeroAmount();
        if (_to == address(0)) revert ZeroAddress();
        if (_to == msg.sender) revert SelfGift();
        if (bytes(_message).length > 140) revert MessageTooLong();

        sizeToken.safeTransferFrom(msg.sender, _to, _amount);

        emit Gift(msg.sender, _to, _amount, _postId, _message);

        if (_postId != bytes32(0)) {
            emit PostTip(msg.sender, _to, _amount, _postId);
        }
    }

    function batchGift(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external nonReentrant {
        require(_recipients.length == _amounts.length, "Length mismatch");
        if (_recipients.length > MAX_BATCH) revert BatchTooLarge();
        if (_recipients.length == 0) revert ZeroAmount();

        uint256 total = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] == 0) revert ZeroAmount();
            if (_recipients[i] == address(0)) revert ZeroAddress();
            if (_recipients[i] == msg.sender) revert SelfGift();
            total += _amounts[i];
        }

        sizeToken.safeTransferFrom(msg.sender, address(this), total);

        for (uint256 i = 0; i < _recipients.length; i++) {
            sizeToken.safeTransfer(_recipients[i], _amounts[i]);
            emit Gift(msg.sender, _recipients[i], _amounts[i], bytes32(0), "");
        }
    }
}
