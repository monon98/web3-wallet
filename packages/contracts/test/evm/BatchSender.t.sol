// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BatchSender} from "../../src/evm/BatchSender.sol";

contract MockErc20 {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
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

contract MockErc20NoReturn {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        uint256 b = balanceOf[from];
        require(b >= amount, "balance");
        allowance[from][msg.sender] = a - amount;
        balanceOf[from] = b - amount;
        balanceOf[to] += amount;
    }
}

contract BatchSenderTest is Test {
    BatchSender internal s;
    address internal alice = address(0xA11CE);
    address internal b = address(0xB0B);
    address internal c = address(0xCaR01);

    function setUp() public {
        s = new BatchSender();
        vm.deal(alice, 10 ether);
    }

    function test_BatchSendEth() public {
        address[] memory to = new address[](2);
        to[0] = b;
        to[1] = c;
        uint256[] memory amt = new uint256[](2);
        amt[0] = 1 ether;
        amt[1] = 2 ether;
        vm.prank(alice);
        s.batchSendEth{value: 3 ether}(to, amt);
        assertEq(b.balance, 1 ether);
        assertEq(c.balance, 2 ether);
    }

    function test_BatchSendEth_revertValue() public {
        address[] memory to = new address[](1);
        to[0] = b;
        uint256[] memory amt = new uint256[](1);
        amt[0] = 1 ether;
        vm.prank(alice);
        vm.expectRevert(BatchSender.BadMsgValue.selector);
        s.batchSendEth{value: 2 ether}(to, amt);
    }

    function test_BatchErc20_standard() public {
        MockErc20 token = new MockErc20();
        token.mint(alice, 1000);
        vm.prank(alice);
        token.approve(address(s), 1000);
        address[] memory to = new address[](2);
        to[0] = b;
        to[1] = c;
        uint256[] memory amt = new uint256[](2);
        amt[0] = 111;
        amt[1] = 222;
        vm.prank(alice);
        s.batchSendErc20TransferFrom(address(token), to, amt);
        assertEq(token.balanceOf(b), 111);
        assertEq(token.balanceOf(c), 222);
        assertEq(token.balanceOf(alice), 1000 - 333);
    }

    function test_BatchErc20_noReturn() public {
        MockErc20NoReturn token = new MockErc20NoReturn();
        token.mint(alice, 1000);
        vm.prank(alice);
        token.approve(address(s), 1000);
        address[] memory to = new address[](1);
        to[0] = b;
        uint256[] memory amt = new uint256[](1);
        amt[0] = 10;
        vm.prank(alice);
        s.batchSendErc20TransferFrom(address(token), to, amt);
        assertEq(token.balanceOf(b), 10);
        assertEq(token.balanceOf(alice), 990);
    }
}
