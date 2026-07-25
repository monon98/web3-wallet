// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* 与 `eth/Token` / `eth/TokenPermit` 共用的轻量 custom errors。 */

error Unauthorized();
error BadAddress();
error BadBalance();
error BadAllowance();
error Expired();
error BadSig();
