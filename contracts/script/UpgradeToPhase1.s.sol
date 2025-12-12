// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";

// Core contracts
import { CollateralVault } from "../src/core/CollateralVault.sol";
import { TermsRegistry } from "../src/core/TermsRegistry.sol";
import { TrustfulValidator } from "../src/core/TrustfulValidator.sol";
import { CouncilRegistry } from "../src/core/CouncilRegistry.sol";
import { ClaimsManager } from "../src/core/ClaimsManager.sol";
import { RulingExecutor } from "../src/core/RulingExecutor.sol";

/**
 * @title UpgradeToPhase1
 * @notice Upgrade existing MVP deployment to Phase 1 by deploying CouncilRegistry,
 *         ClaimsManager, and RulingExecutor, then wiring them to existing contracts
 *
 * Prerequisites:
 *   - MVP contracts already deployed (CollateralVault, TermsRegistry, TrustfulValidator)
 *   - Deployer is governance of existing contracts
 *
 * Run with:
 *   forge script script/UpgradeToPhase1.s.sol:UpgradeToPhase1 \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Required environment variables:
 *   - DEPLOYER_PRIVATE_KEY: Deployer's private key (must be governance)
 *   - RPC_URL: RPC endpoint
 *   - USDC_ADDRESS: USDC token address (from MVP deployment)
 *   - ERC8004_REGISTRY_ADDRESS: ERC-8004 registry address (from MVP deployment)
 *   - COLLATERAL_VAULT_ADDRESS: Existing CollateralVault
 *   - TERMS_REGISTRY_ADDRESS: Existing TermsRegistry
 *   - TRUSTFUL_VALIDATOR_ADDRESS: Existing TrustfulValidator
 */
contract UpgradeToPhase1 is Script {
    // =========================================================================
    // Existing Addresses (from MVP deployment)
    // =========================================================================

    address public usdc;
    address public erc8004Registry;
    address public collateralVault;
    address public termsRegistry;
    address public trustfulValidator;

    // =========================================================================
    // New Phase 1 Addresses
    // =========================================================================

    address public councilRegistry;
    address public claimsManager;
    address public rulingExecutor;

    address public governance;

    function setUp() public {
        // Load existing MVP deployment addresses
        usdc = vm.envAddress("USDC_ADDRESS");
        erc8004Registry = vm.envAddress("ERC8004_REGISTRY_ADDRESS");
        collateralVault = vm.envAddress("COLLATERAL_VAULT_ADDRESS");
        termsRegistry = vm.envAddress("TERMS_REGISTRY_ADDRESS");
        trustfulValidator = vm.envAddress("TRUSTFUL_VALIDATOR_ADDRESS");
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        governance = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("  Trustful Agents: Upgrade MVP to Phase 1");
        console.log("===========================================");
        console.log("");
        console.log("Governance:", governance);
        console.log("Chain ID:", block.chainid);
        console.log("");
        console.log("Existing MVP Contracts:");
        console.log("  USDC:", usdc);
        console.log("  ERC-8004 Registry:", erc8004Registry);
        console.log("  CollateralVault:", collateralVault);
        console.log("  TermsRegistry:", termsRegistry);
        console.log("  TrustfulValidator:", trustfulValidator);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // =====================================================================
        // Step 1: Deploy Phase 1 contracts
        // =====================================================================

        console.log("Deploying Phase 1 contracts...");

        // 1.1 CouncilRegistry
        console.log("  Deploying CouncilRegistry...");
        CouncilRegistry _council = new CouncilRegistry(governance);
        councilRegistry = address(_council);
        console.log("    CouncilRegistry:", councilRegistry);

        // 1.2 ClaimsManager
        console.log("  Deploying ClaimsManager...");
        ClaimsManager _claims = new ClaimsManager(usdc, erc8004Registry, governance);
        claimsManager = address(_claims);
        console.log("    ClaimsManager:", claimsManager);

        // 1.3 RulingExecutor
        console.log("  Deploying RulingExecutor...");
        RulingExecutor _executor = new RulingExecutor(usdc, governance);
        rulingExecutor = address(_executor);
        console.log("    RulingExecutor:", rulingExecutor);

        console.log("");

        // =====================================================================
        // Step 2: Wire existing contracts to new contracts
        // =====================================================================

        console.log("Wiring existing contracts...");

        // 2.1 CollateralVault → ClaimsManager, RulingExecutor
        CollateralVault _vault = CollateralVault(collateralVault);
        _vault.setClaimsManager(claimsManager);
        _vault.setRulingExecutor(rulingExecutor);
        console.log("  CollateralVault: setClaimsManager, setRulingExecutor [OK]");

        // 2.2 TermsRegistry → CouncilRegistry
        TermsRegistry _terms = TermsRegistry(termsRegistry);
        _terms.setCouncilRegistry(councilRegistry);
        console.log("  TermsRegistry: setCouncilRegistry [OK]");

        console.log("");

        // =====================================================================
        // Step 3: Wire new contracts to each other and existing contracts
        // =====================================================================

        console.log("Wiring new contracts...");

        // 3.1 CouncilRegistry
        _council.setTermsRegistry(termsRegistry);
        _council.setClaimsManager(claimsManager);
        console.log("  CouncilRegistry: setTermsRegistry, setClaimsManager [OK]");

        // 3.2 ClaimsManager
        _claims.setCollateralVault(collateralVault);
        _claims.setTermsRegistry(termsRegistry);
        _claims.setCouncilRegistry(councilRegistry);
        _claims.setRulingExecutor(rulingExecutor);
        console.log("  ClaimsManager: setCollateralVault, setTermsRegistry, setCouncilRegistry, setRulingExecutor [OK]");

        // 3.3 RulingExecutor
        _executor.setClaimsManager(claimsManager);
        _executor.setCollateralVault(collateralVault);
        _executor.setCouncilRegistry(councilRegistry);
        console.log("  RulingExecutor: setClaimsManager, setCollateralVault, setCouncilRegistry [OK]");

        vm.stopBroadcast();

        // =====================================================================
        // Summary
        // =====================================================================

        console.log("");
        console.log("===========================================");
        console.log("  Upgrade Summary");
        console.log("===========================================");
        console.log("");
        console.log("Network:", _getNetworkName(block.chainid));
        console.log("Governance:", governance);
        console.log("");
        console.log("Existing (unchanged):");
        console.log("  CollateralVault:", collateralVault);
        console.log("  TermsRegistry:", termsRegistry);
        console.log("  TrustfulValidator:", trustfulValidator);
        console.log("");
        console.log("New Phase 1 contracts:");
        console.log("  CouncilRegistry:", councilRegistry);
        console.log("  ClaimsManager:", claimsManager);
        console.log("  RulingExecutor:", rulingExecutor);
        console.log("");

        console.log("===========================================");
        console.log("  Next Steps");
        console.log("===========================================");
        console.log("");
        console.log("1. Create a default council:");
        console.log("   cast send", councilRegistry);
        console.log('     "createCouncil(string,string,string,uint256,uint256,uint256,uint256)"');
        console.log('     "General" "Default council" "general" 5000 1000 604800 259200');
        console.log("     --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY");
        console.log("");
        console.log("2. Add council members:");
        console.log("   cast send", councilRegistry);
        console.log('     "addMember(bytes32,address)" <COUNCIL_ID> <MEMBER_ADDRESS>');
        console.log("     --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY");
        console.log("");
        console.log("3. Update deployments/", block.chainid, ".json");

        // Write deployment addresses
        _writeDeploymentFile();
    }

    function _getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "Ethereum Mainnet";
        if (chainId == 11155111) return "Sepolia";
        if (chainId == 8453) return "Base Mainnet";
        if (chainId == 84532) return "Base Sepolia";
        if (chainId == 31337) return "Anvil (Local)";
        return "Unknown";
    }

    function _writeDeploymentFile() internal {
        string memory filename = string(
            abi.encodePacked("deployments/", vm.toString(block.chainid), ".json")
        );

        // Build JSON
        string memory part1 = string(abi.encodePacked(
            "{\n",
            '  "chainId": ', vm.toString(block.chainid), ",\n",
            '  "upgradedAt": ', vm.toString(block.timestamp), ",\n",
            '  "governance": "', vm.toString(governance), '",\n',
            '  "usdc": "', vm.toString(usdc), '",\n',
            '  "erc8004Registry": "', vm.toString(erc8004Registry), '",\n'
        ));

        string memory part2 = string(abi.encodePacked(
            '  "collateralVault": "', vm.toString(collateralVault), '",\n',
            '  "termsRegistry": "', vm.toString(termsRegistry), '",\n',
            '  "trustfulValidator": "', vm.toString(trustfulValidator), '",\n'
        ));

        string memory part3 = string(abi.encodePacked(
            '  "councilRegistry": "', vm.toString(councilRegistry), '",\n',
            '  "claimsManager": "', vm.toString(claimsManager), '",\n',
            '  "rulingExecutor": "', vm.toString(rulingExecutor), '"\n',
            "}"
        ));

        string memory json = string(abi.encodePacked(part1, part2, part3));
        vm.writeFile(filename, json);
        console.log("");
        console.log("Deployment addresses written to:", filename);
    }
}
