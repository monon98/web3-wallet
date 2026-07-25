// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BalanceBatchReader} from "../../src/evm/BalanceBatchReader.sol";

contract MockERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowance;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowance[msg.sender][spender] = amount;
        return true;
    }

    function allowance(address o, address s) external view returns (uint256) {
        return _allowance[o][s];
    }
}

contract BalanceBatchReaderTest is Test {
    BalanceBatchReader internal r;
    MockERC20 internal token;
    address internal alice = address(0xA11CE);
    address internal b = address(0xB0B);
    address internal sp = address(0xBEEF);

    function setUp() public {
        r = new BalanceBatchReader();
        token = new MockERC20();
        vm.deal(alice, 1 ether);
        vm.deal(b, 2 ether);
        token.mint(alice, 300);
        token.mint(b, 700);
        vm.prank(alice);
        token.approve(sp, 111);
        vm.prank(b);
        token.approve(sp, 222);
    }

    function test_GetNative() public view {
        address[] memory a = new address[](2);
        a[0] = alice;
        a[1] = b;
        uint256[] memory bal = r.getNativeBalances(a);
        assertEq(bal[0], 1 ether);
        assertEq(bal[1], 2 ether);
    }

    function test_GetErc20() public view {
        address[] memory a = new address[](2);
        a[0] = alice;
        a[1] = b;
        address[] memory tok = new address[](1);
        tok[0] = address(token);
        (uint256[] memory tb, bool[] memory ok) = r.getErc20Balances(a, tok);
        assertTrue(ok[0]);
        assertEq(tb[0], 300);
        assertTrue(ok[1]);
        assertEq(tb[1], 700);
    }

    function test_GetAllowances() public view {
        address[] memory h = new address[](2);
        h[0] = alice;
        h[1] = b;
        (uint256[] memory am, bool[] memory ok) = r.getAllowances(address(token), sp, h);
        assertTrue(ok[0]);
        assertEq(am[0], 111);
        assertTrue(ok[1]);
        assertEq(am[1], 222);
    }

    function test_GetBalances() public view {
        address[] memory a = new address[](2);
        a[0] = alice;
        a[1] = b;
        address[] memory tok = new address[](1);
        tok[0] = address(token);
        (uint256[] memory nb, uint256[] memory tb, bool[] memory ok) = r.getBalances(a, tok);
        assertEq(nb[0], 1 ether);
        assertEq(nb[1], 2 ether);
        assertTrue(ok[0]);
        assertEq(tb[0], 300);
        assertTrue(ok[1]);
        assertEq(tb[1], 700);
    }

    function test_GetBalances_emptyTokenList() public view {
        address[] memory a = new address[](1);
        a[0] = alice;
        address[] memory tok = new address[](0);
        (uint256[] memory nb, uint256[] memory tb, bool[] memory oks) = r.getBalances(a, tok);
        assertEq(nb[0], 1 ether);
        assertEq(tb.length, 0);
        assertEq(oks.length, 0);
    }

    function test_BadToken() public view {
        address[] memory a = new address[](1);
        a[0] = alice;
        address[] memory tok = new address[](1);
        tok[0] = address(0x1234);
        (, uint256[] memory tb, bool[] memory ok) = r.getBalances(a, tok);
        assertFalse(ok[0]);
        assertEq(tb[0], 0);
    }

    function test_ZeroToken() public view {
        address[] memory a = new address[](1);
        a[0] = alice;
        address[] memory tok = new address[](1);
        tok[0] = address(0);
        (, uint256[] memory tb, bool[] memory ok) = r.getBalances(a, tok);
        assertFalse(ok[0]);
        assertEq(tb[0], 0);
    }
}
