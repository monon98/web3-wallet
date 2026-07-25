// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20TransferFrom {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchCollector
/// @notice 多源 `approve` 后，将同一 ERC-20 经 `transferFrom` 归至单地址。多 EOA 的 ETH 无法如 ERC-20 般同笔无签名归集，见本目录 `BatchSender` 的 NatSpec。

contract BatchCollector {
    error LengthMismatch();
    error BadAddress();
    error BadAmount();
    error Erc20Failed(uint256 index, address token, address from, address to, uint256 amount);

    event Erc20Collected(
        address indexed token, address indexed to, uint256 totalAmount, uint256 count
    );

    function collectErc20Batch(
        address token,
        address[] calldata from,
        address to,
        uint256[] calldata amounts
    ) external {
        uint256 n = from.length;
        if (n != amounts.length) revert LengthMismatch();
        if (token == address(0) || to == address(0)) revert BadAddress();

        uint256 total = 0;
        for (uint256 i = 0; i < n; i++) {
            if (from[i] == address(0)) revert BadAddress();
            uint256 amt = amounts[i];
            if (amt == 0) revert BadAmount();
            total += amt;
        }

        for (uint256 i = 0; i < n; i++) {
            _transferFrom(token, from[i], to, amounts[i], i);
        }

        emit Erc20Collected(token, to, total, n);
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
        if (!ok) revert Erc20Failed(index, token, from, to, amount);
        if (data.length > 0) {
            if (data.length != 32) revert Erc20Failed(index, token, from, to, amount);
            bool success = abi.decode(data, (bool));
            if (!success) revert Erc20Failed(index, token, from, to, amount);
        }
    }
}
