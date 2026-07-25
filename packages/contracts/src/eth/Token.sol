// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Unauthorized, BadAddress, BadBalance, BadAllowance} from "../common/Err.sol";

/// @title Token
/// @notice 标准 ERC-20（在 Tron TVM 上部署即 TRC-20 行为）。不接收链上原生币。
/// @dev 各链分别部署；用目标链的 Solidity 0.8.x 工具链编译。

contract Token {
    string private _name;
    string private _symbol;
    uint8 private immutable _decimals;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public admin;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AdminChanged(address indexed previous, address indexed next);
    event AdminReleased(address indexed previous);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    /// @param name_ 全名
    /// @param symbol_ 符号
    /// @param decimals_ 小数位
    /// @param supply_ 首次铸造量（已按最小单位计），付给 `msg.sender` 并设其为 `admin`
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 supply_
    ) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        admin = msg.sender;
        if (supply_ > 0) {
            _mint(msg.sender, supply_);
        }
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address a) public view returns (uint256) {
        return _balances[a];
    }

    function allowance(address from, address spender) public view returns (uint256) {
        return _allowances[from][spender];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _setAllowance(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 cur = _allowances[from][msg.sender];
        if (cur < amount) revert BadAllowance();
        if (cur != type(uint256).max) {
            _allowances[from][msg.sender] = cur - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyAdmin {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        uint256 a = _allowances[from][msg.sender];
        if (a < amount) revert BadAllowance();
        if (a != type(uint256).max) {
            _allowances[from][msg.sender] = a - amount;
        }
        _burn(from, amount);
    }

    function transferAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert BadAddress();
        address p = admin;
        admin = next;
        emit AdminChanged(p, next);
    }

    function renounceAdmin() external onlyAdmin {
        address p = admin;
        admin = address(0);
        emit AdminReleased(p);
    }

    function _move(address from, address to, uint256 amount) private {
        if (to == address(0)) revert BadAddress();
        uint256 b = _balances[from];
        if (b < amount) revert BadBalance();
        unchecked {
            _balances[from] = b - amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _setAllowance(address from, address spender, uint256 amount) private {
        if (spender == address(0)) revert BadAddress();
        _allowances[from][spender] = amount;
        emit Approval(from, spender, amount);
    }

    function _mint(address to, uint256 amount) private {
        if (to == address(0)) revert BadAddress();
        if (amount == 0) return;
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) private {
        uint256 b = _balances[from];
        if (b < amount) revert BadBalance();
        unchecked {
            _balances[from] = b - amount;
            _totalSupply -= amount;
        }
        emit Transfer(from, address(0), amount);
    }
}
