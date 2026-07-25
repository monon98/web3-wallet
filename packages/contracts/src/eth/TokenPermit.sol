// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    Unauthorized,
    BadAddress,
    BadBalance,
    BadAllowance,
    Expired,
    BadSig
} from "../common/Err.sol";

/// @title TokenPermit
/// @notice 在 `Token` 上增加 **EIP-2612** `permit`（EIP-712 签名授权），其它语义同 `eth/Token`。
/// @dev Tron 侧需保证签名与 20 字节 `address` 的 EIP-712 流程与集成方一致。

contract TokenPermit {
    string private _name;
    string private _symbol;
    uint8 private immutable _decimals;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public admin;
    mapping(address => uint256) private _nonces;

    bytes32 private constant _DOMAIN =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant _VER = keccak256("1");

    uint256 private constant _S_MAX = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0E;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AdminChanged(address indexed previous, address indexed next);
    event AdminReleased(address indexed previous);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

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

    function nonces(address a) external view returns (uint256) {
        return _nonces[a];
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(_DOMAIN, keccak256(bytes(_name)), _VER, block.chainid, address(this))
            );
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp > deadline) revert Expired();
        if (owner == address(0) || spender == address(0)) revert BadAddress();
        if (uint256(s) > _S_MAX) revert BadSig();
        if (v != 27 && v != 28) revert BadSig();

        uint256 n = _nonces[owner];
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, n, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
        if (ecrecover(digest, v, r, s) != owner) revert BadSig();

        unchecked {
            _nonces[owner] = n + 1;
        }
        _setAllowance(owner, spender, value);
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
