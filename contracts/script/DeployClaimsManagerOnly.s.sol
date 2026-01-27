// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/ClaimsManager.sol";

contract DeployClaimsManagerOnly is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerKey);
        
        ClaimsManager cm = new ClaimsManager(
            0x63d5a529eD8a8192E2201c0cea4469397efE30Ba,
            0xb3B4b5042Fd3600404846671Ff5558719860b694,
            0x5E72fF7BBf94158815e61F5E9CDD8E47Fb8Ba845
        );
        
        vm.stopBroadcast();
        
        console.log("ClaimsManager:", address(cm));
    }
}
