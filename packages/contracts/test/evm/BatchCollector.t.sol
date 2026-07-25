// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchCollector} from "../../src/evm/BatchCollector.sol";

contract MockErc20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        uint256 b = balanceOf[from];
        require(b >= amount, "balance");
        allowance[from][msg.sender] = a - amount;
        balanceOf[from] = b - amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract BatchCollectorTest is Test {
    BatchCollector internal c;
    MockErc20 internal token;
    address internal alice = address(0xA11CE);
    address internal b = address(0xB0B);
    address payable internal taddr = payable(address(0x7E4A));

    function setUp() public {
        c = new BatchCollector();
        token = new MockErc20();
        token.mint(alice, 100);
        token.mint(b, 200);
    }

    function test_Collect() public {
        vm.prank(alice);
        token.approve(address(c), 100);
        vm.prank(b);
        token.approve(address(c), 200);
        address[] memory f = new address[](2);
        f[0] = alice;
        f[1] = b;
        uint256[] memory am = new uint256[](2);
        am[0] = 40;
        am[1] = 60;
        c.collectErc20Batch(address(token), f, taddr, am);
        assertEq(token.balanceOf(taddr), 100);
        assertEq(token.balanceOf(alice), 60);
        assertEq(token.balanceOf(b), 140);
    }
}
