// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TokenPermit} from "../../src/eth/TokenPermit.sol";
import {Expired, BadSig} from "../../src/common/Err.sol";

contract TokenPermitTest is Test {
    TokenPermit internal t;
    uint256 internal constant _K = 0xA11cE;
    address internal alice;
    address internal bob = address(0xB0b);

    function setUp() public {
        vm.chainId(1);
        alice = vm.addr(_K);
        t = new TokenPermit("P", "P", 18, 0);
        t.mint(alice, 1_000 ether);
    }

    function _digest(
        address signOwner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(t.PERMIT_TYPEHASH(), signOwner, spender, value, nonce, deadline)
        );
        return keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash));
    }

    function test_PermitThenTransferFrom() public {
        address spender = address(0xCAFE);
        uint256 value = 100 ether;
        uint256 deadline = block.timestamp + 1 days;
        bytes32 d = _digest(alice, spender, value, t.nonces(alice), deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_K, d);
        vm.prank(address(0xBADD));
        t.permit(alice, spender, value, deadline, v, r, s);
        assertEq(t.allowance(alice, spender), value);
        assertEq(t.nonces(alice), 1);
        vm.prank(spender);
        t.transferFrom(alice, bob, 50 ether);
        assertEq(t.balanceOf(bob), 50 ether);
    }

    function test_Expired() public {
        address spender = address(0xCAFE);
        uint256 v = 1 ether;
        uint256 dl = block.timestamp + 1;
        bytes32 d = _digest(alice, spender, v, t.nonces(alice), dl);
        (uint8 v_, bytes32 r, bytes32 s) = vm.sign(_K, d);
        vm.warp(block.timestamp + 2);
        vm.expectRevert(Expired.selector);
        t.permit(alice, spender, v, dl, v_, r, s);
    }

    function test_BadSig() public {
        address spender = address(0xCAFE);
        uint256 v = 1 ether;
        uint256 deadline = block.timestamp + 1 days;
        bytes32 d = _digest(alice, spender, v, t.nonces(alice), deadline);
        (uint8 v_, bytes32 r, bytes32 s) = vm.sign(0xBADC0FFEE, d);
        vm.expectRevert(BadSig.selector);
        t.permit(alice, spender, v, deadline, v_, r, s);
    }
}
