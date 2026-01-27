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
 * @title DeployClaimsPhase
 * @notice Deploy ClaimsManager and RulingExecutor, wire to existing contracts
 *         (including already-deployed CouncilRegistry)
 *
 * Prerequisites:
 *   - MVP contracts already deployed (CollateralVault, TermsRegistry, TrustfulValidator)
 *   - CouncilRegistry already deployed
 *   - Deployer is governance of all existing contracts
 *
 * Run with:
 *   forge script script/DeployClaimsPhase.s.sol:DeployClaimsPhase \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Required environment variables:
 *   - DEPLOYER_PRIVATE_KEY: Deployer's private key (must be governance)
 *   - RPC_URL: RPC endpoint
 *   - USDC_ADDRESS: USDC token address
 *   - ERC8004_REGISTRY_ADDRESS: ERC-8004 registry address
 *   - COLLATERAL_VAULT_ADDRESS: Existing CollateralVault
 *   - TERMS_REGISTRY_ADDRESS: Existing TermsRegistry
 *   - TRUSTFUL_VALIDATOR_ADDRESS: Existing TrustfulValidator
 *   - COUNCIL_REGISTRY_ADDRESS: Existing CouncilRegistry (already deployed!)
 */
contract DeployClaimsPhase is Script {
    // =========================================================================
    // Existing Addresses (from previous deployments)
    // =========================================================================

    address public usdc;
    address public erc8004Registry;
    address public collateralVault;
    address public termsRegistry;
    address public trustfulValidator;
    address public councilRegistry;  // Already deployed!

    // =========================================================================
    // New Addresses (to be deployed)
    // =========================================================================

    address public claimsManager;
    address public rulingExecutor;

    address public governance;

    function setUp() public {
        // Load existing deployment addresses
        usdc = vm.envAddress("USDC_ADDRESS");
        erc8004Registry = vm.envAddress("ERC8004_REGISTRY_ADDRESS");
        collateralVault = vm.envAddress("COLLATERAL_VAULT_ADDRESS");
        termsRegistry = vm.envAddress("TERMS_REGISTRY_ADDRESS");
        trustfulValidator = vm.envAddress("TRUSTFUL_VALIDATOR_ADDRESS");
        councilRegistry = vm.envAddress("COUNCIL_REGISTRY_ADDRESS");  // Already deployed!
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        governance = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("  Trustful Agents: Deploy Claims Phase");
        console.log("===========================================");
        console.log("");
        console.log("Governance:", governance);
        console.log("Chain ID:", block.chainid);
        console.log("");
        console.log("Existing Contracts:");
        console.log("  USDC:", usdc);
        console.log("  ERC-8004 Registry:", erc8004Registry);
        console.log("  CollateralVault:", collateralVault);
        console.log("  TermsRegistry:", termsRegistry);
        console.log("  TrustfulValidator:", trustfulValidator);
        console.log("  CouncilRegistry:", councilRegistry, "(already deployed)");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // =====================================================================
        // Step 1: Deploy ClaimsManager and RulingExecutor
        // =====================================================================

        console.log("Deploying new contracts...");

        // 1.1 ClaimsManager
        console.log("  Deploying ClaimsManager...");
        ClaimsManager _claims = new ClaimsManager(usdc, erc8004Registry, governance);
        claimsManager = address(_claims);
        console.log("    ClaimsManager:", claimsManager);

        // 1.2 RulingExecutor
        console.log("  Deploying RulingExecutor...");
        RulingExecutor _executor = new RulingExecutor(usdc, governance);
        rulingExecutor = address(_executor);
        console.log("    RulingExecutor:", rulingExecutor);

        console.log("");

        // =====================================================================
        // Step 2: Wire existing contracts to new contracts
        // =====================================================================

        console.log("Wiring existing contracts to new contracts...");

        // 2.1 CollateralVault → ClaimsManager, RulingExecutor
        CollateralVault _vault = CollateralVault(collateralVault);
        _vault.setClaimsManager(claimsManager);
        _vault.setRulingExecutor(rulingExecutor);
        console.log("  CollateralVault: setClaimsManager, setRulingExecutor [OK]");

        // 2.2 CouncilRegistry → ClaimsManager
        CouncilRegistry _council = CouncilRegistry(councilRegistry);
        _council.setClaimsManager(claimsManager);
        console.log("  CouncilRegistry: setClaimsManager [OK]");

        console.log("");

        // =====================================================================
        // Step 3: Wire new contracts to existing contracts
        // =====================================================================

        console.log("Wiring new contracts to existing contracts...");

        // 3.1 ClaimsManager → all dependencies
        _claims.setCollateralVault(collateralVault);
        _claims.setTermsRegistry(termsRegistry);
        _claims.setCouncilRegistry(councilRegistry);
        _claims.setRulingExecutor(rulingExecutor);
        console.log("  ClaimsManager: setCollateralVault, setTermsRegistry, setCouncilRegistry, setRulingExecutor [OK]");

        // 3.2 RulingExecutor → all dependencies
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
        console.log("  Deployment Summary");
        console.log("===========================================");
        console.log("");
        console.log("Network:", _getNetworkName(block.chainid));
        console.log("Governance:", governance);
        console.log("");
        console.log("Existing (unchanged):");
        console.log("  USDC:", usdc);
        console.log("  ERC-8004 Registry:", erc8004Registry);
        console.log("  CollateralVault:", collateralVault);
        console.log("  TermsRegistry:", termsRegistry);
        console.log("  TrustfulValidator:", trustfulValidator);
        console.log("  CouncilRegistry:", councilRegistry);
        console.log("");
        console.log("Newly deployed:");
        console.log("  ClaimsManager:", claimsManager);
        console.log("  RulingExecutor:", rulingExecutor);
        console.log("");

        console.log("===========================================");
        console.log("  Update Your Config Files");
        console.log("===========================================");
        console.log("");
        console.log("Add to deployments/84532.json:");
        console.log('  "claimsManager": "', claimsManager, '",');
        console.log('  "rulingExecutor": "', rulingExecutor, '"');
        console.log("");
        console.log("Add to .env for Council Dashboard:");
        console.log("  VITE_CLAIMS_MANAGER_ADDRESS=", claimsManager);
        console.log("  VITE_RULING_EXECUTOR_ADDRESS=", rulingExecutor);

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

        // Build JSON with all addresses
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
