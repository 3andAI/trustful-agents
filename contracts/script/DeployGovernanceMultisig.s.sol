// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/GovernanceMultisig.sol";

contract DeployGovernanceMultisig is Script {
    // Signers
    address constant ELISA = 0x9c9db6A852d315088f808E7D0e372aec85d6d212;
    address constant MATTHIAS = 0x5E72fF7BBf94158815e61F5E9CDD8E47Fb8Ba845;
    address constant INGO = 0xb1202E59429781bD95aca6a1FD8Ea7B227c88536;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        GovernanceMultisig multisig = new GovernanceMultisig(
            ELISA,
            MATTHIAS,
            INGO
        );
        
        vm.stopBroadcast();
        
        console.log("GovernanceMultisig deployed to:", address(multisig));
        console.log("Signers:");
        console.log("  - ELISA:", ELISA);
        console.log("  - MATTHIAS:", MATTHIAS);
        console.log("  - INGO:", INGO);
        console.log("Threshold: 2 of 3");
        console.log("");
        console.log("Next steps:");
        console.log("1. MATTHIAS must call setGovernance() on CouncilRegistry");
        console.log("   to transfer governance to this contract");
    }
}
