// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchSender
/// @notice 一账户多笔：向多地址发原生币，或经 `transferFrom` 发 ERC-20；任一步失败则整笔回滚。

contract BatchSender {
    error LengthMismatch();
    error BadRecipient();
    error BadAmount();
    error BadMsgValue();
    error EthFailed(uint256 index, address to, uint256 amount);
    error Erc20Failed(uint256 index, address token, address to, uint256 amount);

    event EthBatch(address indexed from, uint256 total, uint256 n);
    event Erc20Batch(address indexed from, address indexed token, uint256 total, uint256 n);

    function batchSendEth(address[] calldata recipients, uint256[] calldata amounts) external payable {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();

        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) {
            address to = recipients[i];
            if (to == address(0)) revert BadRecipient();
            uint256 amt = amounts[i];
            if (amt == 0) revert BadAmount();
            total += amt;
        }

        if (msg.value != total) revert BadMsgValue();

        for (uint256 i = 0; i < n; i++) {
            (bool ok, ) = payable(recipients[i]).call{value: amounts[i]}("");
            if (!ok) revert EthFailed(i, recipients[i], amounts[i]);
        }

        emit EthBatch(msg.sender, total, n);
    }

    function batchSendErc20TransferFrom(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        if (token == address(0)) revert BadRecipient();

        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) {
            address to = recipients[i];
            if (to == address(0)) revert BadRecipient();
            uint256 amt = amounts[i];
            if (amt == 0) revert BadAmount();
            total += amt;
        }

        for (uint256 i = 0; i < n; i++) {
            _transferFrom(token, msg.sender, recipients[i], amounts[i], i);
        }

        emit Erc20Batch(msg.sender, token, total, n);
    }

    function _transferFrom(
        address token,
        address from,
        address to,
        uint256 amount,
        uint256 index
    ) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20TransferFrom.transferFrom.selector, from, to, amount)
        );
        if (!ok) revert Erc20Failed(index, token, to, amount);
        if (data.length > 0) {
            if (data.length != 32) revert Erc20Failed(index, token, to, amount);
            bool success = abi.decode(data, (bool));
            if (!success) revert Erc20Failed(index, token, to, amount);
        }
    }
}
