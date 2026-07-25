// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Token} from "../../src/eth/Token.sol";
import {Unauthorized} from "../../src/common/Err.sol";

contract TokenTest is Test {
    Token internal t;
    address internal alice = address(0xA11c3);
    address internal bob = address(0xB0b);

    function setUp() public {
        t = new Token("TT", "T", 18, 1_000 ether);
    }

    function test_MetadataAndInitial() public view {
        assertEq(t.name(), "TT");
        assertEq(t.symbol(), "T");
        assertEq(t.decimals(), 18);
        assertEq(t.totalSupply(), 1_000 ether);
        assertEq(t.balanceOf(address(this)), 1_000 ether);
        assertEq(t.admin(), address(this));
    }

    function test_Transfer() public {
        t.transfer(alice, 100 ether);
        assertEq(t.balanceOf(alice), 100 ether);
    }

    function test_ApproveAndTransferFrom() public {
        t.transfer(alice, 200 ether);
        vm.prank(alice);
        t.approve(bob, 50 ether);
        assertEq(t.allowance(alice, bob), 50 ether);
        vm.prank(bob);
        t.transferFrom(alice, bob, 30 ether);
        assertEq(t.balanceOf(bob), 30 ether);
    }

    function test_MintOnlyAdmin() public {
        t.mint(alice, 1 ether);
        assertEq(t.balanceOf(alice), 1 ether);
    }

    function test_MintRevertsIfNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert(Unauthorized.selector);
        t.mint(bob, 1);
    }

    function test_Burn() public {
        uint256 s = t.totalSupply();
        t.burn(10 ether);
        assertEq(t.balanceOf(address(this)), 1_000 ether - 10 ether);
        assertEq(t.totalSupply(), s - 10 ether);
    }
}
