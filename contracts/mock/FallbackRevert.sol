// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../interfaces/IAuctionRunner.sol";
import "../interfaces/IEthCreditRecovery.sol";

/**
 * @title FallbackRevert
 *
 * @notice Can bid on an auction but will revert on ETH transfers (e.g. bid return on outbid)
 *
 */
contract FallbackRevert {

    bool public revertOnReceive;

    constructor() {
      revertOnReceive = true;
    }

    function setShouldRevert(bool _shouldRevert) external {
      revertOnReceive = _shouldRevert;
    }

    function bidOnAuction(address _marketDiamond, uint256 _consignmentId) external payable {
      IAuctionRunner auction = IAuctionRunner(_marketDiamond);
      auction.bid{value: msg.value}(_consignmentId);
    }

    fallback() external payable {
      if(revertOnReceive) {
        require(msg.value <= 0, "reverting");
      }
    }

}