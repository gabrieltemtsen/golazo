// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal stand-in for the Circles (CRC) ERC-20 used in tests/local dev.
contract MockCRC is ERC20 {
    constructor() ERC20("Circles", "CRC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
