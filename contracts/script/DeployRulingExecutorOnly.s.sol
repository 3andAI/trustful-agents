// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/RulingExecutor.sol";

contract DeployRulingExecutorOnly is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerKey);
        
        RulingExecutor re = new RulingExecutor(
            0x63d5a529eD8a8192E2201c0cea4469397efE30Ba,
            0x5E72fF7BBf94158815e61F5E9CDD8E47Fb8Ba845
        );
        
        vm.stopBroadcast();
        
        console.log("RulingExecutor:", address(re));
    }
}
