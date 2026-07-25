// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * 链上只读批量查询：原生余额、ERC-20 余额、同一代币下多 holder 对同一 spender 的 allowance。
 * 服务端 `balance-reader` 走 `getBalances`；`getNativeBalances` / `getErc20Balances` / `getAllowances` 供原子化 eth_call。
 * 无密钥材料；仅 view。
 */

/// @notice 最小 ERC-20 余额接口（与主网代币 `balanceOf` 一致即可）
interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice 最小 ERC-20 授权查询接口
interface IERC20Allowance {
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title BalanceBatchReader
/// @author Plugin monorepo
/// @notice 只读批量：原生、ERC-20 余额、同币多 holder 对单 spender 的 `allowance`（见各方法说明）。
/// @dev `eth_call`；`getBalances` 为组合；大请求需拆批。
contract BalanceBatchReader {
    function getNativeBalances(address[] calldata accounts)
        external
        view
        returns (uint256[] memory balances)
    {
        return _nativeBalances(accounts);
    }

    function getErc20Balances(
        address[] calldata accounts,
        address[] calldata tokens
    )
        external
        view
        returns (uint256[] memory balances, bool[] memory ok)
    {
        return _erc20Balances(accounts, tokens);
    }

    function getAllowances(
        address token,
        address spender,
        address[] calldata holders
    ) external view returns (uint256[] memory amounts, bool[] memory ok) {
        return _getAllowanceBatch(token, spender, holders);
    }

    function getBalances(
        address[] calldata accounts,
        address[] calldata tokens
    )
        external
        view
        returns (
            uint256[] memory nativeBalances,
            uint256[] memory tokenBalances,
            bool[] memory tokenBalanceOk
        )
    {
        nativeBalances = _nativeBalances(accounts);
        (tokenBalances, tokenBalanceOk) = _erc20Balances(accounts, tokens);
    }

    function _nativeBalances(address[] calldata accounts)
        private
        view
        returns (uint256[] memory balances)
    {
        uint256 n = accounts.length;
        balances = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            balances[i] = accounts[i].balance;
        }
    }

    function _erc20Balances(
        address[] calldata accounts,
        address[] calldata tokens
    ) private view returns (uint256[] memory balances, bool[] memory ok) {
        uint256 n = accounts.length;
        uint256 m = tokens.length;
        uint256 tm = n * m;
        balances = new uint256[](tm);
        ok = new bool[](tm);

        uint256 idx = 0;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < m; j++) {
                address token = tokens[j];
                if (token == address(0)) {
                    balances[idx] = 0;
                    ok[idx] = false;
                } else {
                    try IERC20Balance(token).balanceOf(accounts[i]) returns (uint256 b) {
                        balances[idx] = b;
                        ok[idx] = true;
                    } catch {
                        balances[idx] = 0;
                        ok[idx] = false;
                    }
                }
                unchecked {
                    idx++;
                }
            }
        }
    }

    function _getAllowanceBatch(
        address token,
        address spender,
        address[] calldata holders
    ) private view returns (uint256[] memory amounts, bool[] memory ok) {
        uint256 n = holders.length;
        amounts = new uint256[](n);
        ok = new bool[](n);

        if (token == address(0) || spender == address(0)) {
            for (uint256 i = 0; i < n; i++) {
                amounts[i] = 0;
                ok[i] = false;
            }
            return (amounts, ok);
        }

        for (uint256 i = 0; i < n; i++) {
            address holder = holders[i];
            if (holder == address(0)) {
                amounts[i] = 0;
                ok[i] = false;
            } else {
                try IERC20Allowance(token).allowance(holder, spender) returns (uint256 a) {
                    amounts[i] = a;
                    ok[i] = true;
                } catch {
                    amounts[i] = 0;
                    ok[i] = false;
                }
            }
        }
    }
}
