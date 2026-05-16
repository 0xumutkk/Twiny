// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TwinyCampaign.sol";

/**
 * Deploy TwinyCampaign to Monad testnet.
 *
 * Usage:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url https://testnet-rpc.monad.xyz \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --chain 10143 \
 *     --verifier sourcify \
 *     --verifier-url https://sourcify-api-monad.blockvision.org/
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deploying TwinyCampaign...");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        TwinyCampaign campaign = new TwinyCampaign();

        console.log("TwinyCampaign deployed at:", address(campaign));

        // Seed a demo campaign (3 days deadline, 1.2 MON reward x 10 users)
        // Value: 1.2 MON * 10 = 12 MON  → msg.value = 12e18
        uint256 deadline = block.timestamp + 3 days;
        campaign.registerCampaign{value: 12 ether}(
            "Monad Wallet Beta",
            "Test the Monad wallet integration and submit feedback.",
            1.2 ether,   // 1.2 MON per user
            10,          // max 10 claims
            deadline,
            "low",
            2            // ~2 minutes
        );

        console.log("Demo campaign registered. Campaign ID: 1");

        vm.stopBroadcast();
    }
}
