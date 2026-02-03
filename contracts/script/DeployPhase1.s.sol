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

// Mocks for testnet
import { ERC20Mock } from "../test/mocks/ERC20Mock.sol";
import { ERC8004RegistryMock } from "../test/mocks/ERC8004RegistryMock.sol";

/**
 * @title DeployPhase1
 * @notice Complete Phase 1 deployment: All 6 core contracts
 * @dev Deploys and wires: CollateralVault, TermsRegistry, TrustfulValidator,
 *      CouncilRegistry, ClaimsManager, RulingExecutor
 *
 * Run with:
 *   forge script script/DeployPhase1.s.sol:DeployPhase1 \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Required environment variables:
 *   - DEPLOYER_PRIVATE_KEY: Private key of deployer
 *   - RPC_URL: RPC endpoint (e.g., Base Sepolia)
 *
 * Optional environment variables:
 *   - GOVERNANCE_ADDRESS: Address for governance (Safe multisig). Defaults to deployer.
 *   - USDC_ADDRESS: Existing USDC address (deploys mock if not set)
 *   - ERC8004_REGISTRY_ADDRESS: Existing registry (deploys mock if not set)
 *   - WITHDRAWAL_GRACE_PERIOD: Grace period in seconds (default: 7 days)
 *   - MIN_COLLATERAL_AMOUNT: Minimum collateral in USDC units (default: 100e6)
 *   - VALIDATION_BASE_URI: Base URI for validation responses
 *
 * Upgrade Mode:
 *   - UPGRADE_MODE=true: Only deploy new Phase 1 contracts (Council, Claims, Ruling)
 *   - Uses existing MVP contracts from deployments/{chainId}.json
 */
contract DeployPhase1 is Script {
    // =========================================================================
    // Deployed Addresses
    // =========================================================================

    // Mocks (only deployed if not provided)
    address public mockUsdc;
    address public mockErc8004Registry;

    // Core contracts - MVP (existing or deployed)
    address public collateralVault;
    address public termsRegistry;
    address public trustfulValidator;

    // Core contracts - Phase 1 additions
    address public councilRegistry;
    address public claimsManager;
    address public rulingExecutor;

    // =========================================================================
    // Configuration
    // =========================================================================

    address public usdc;
    address public erc8004Registry;
    address public governance;
    uint256 public withdrawalGracePeriod;
    uint256 public minimumCollateral;
    string public validationBaseUri;
    bool public upgradeMode;

    // Existing addresses for upgrade mode
    address public existingCollateralVault;
    address public existingTermsRegistry;
    address public existingTrustfulValidator;

    function setUp() public {
        // Load configuration from environment
        usdc = vm.envOr("USDC_ADDRESS", address(0));
        erc8004Registry = vm.envOr("ERC8004_REGISTRY_ADDRESS", address(0));
        withdrawalGracePeriod = vm.envOr("WITHDRAWAL_GRACE_PERIOD", uint256(7 days));
        minimumCollateral = vm.envOr("MIN_COLLATERAL_AMOUNT", uint256(100e6)); // 100 USDC
        validationBaseUri = vm.envOr("VALIDATION_BASE_URI", string("https://trustful.ai/v/"));
        upgradeMode = vm.envOr("UPGRADE_MODE", false);

        // Load existing addresses for upgrade mode
        if (upgradeMode) {
            existingCollateralVault = vm.envAddress("COLLATERAL_VAULT_ADDRESS");
            existingTermsRegistry = vm.envAddress("TERMS_REGISTRY_ADDRESS");
            existingTrustfulValidator = vm.envAddress("TRUSTFUL_VALIDATOR_ADDRESS");
        }
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        governance = vm.envOr("GOVERNANCE_ADDRESS", deployer);

        console.log("===========================================");
        console.log("  Trustful Agents Phase 1 Deployment");
        console.log("===========================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Governance:", governance);
        console.log("Chain ID:", block.chainid);
        console.log("Mode:", upgradeMode ? "UPGRADE (new Phase 1 contracts only)" : "FULL");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // =====================================================================
        // Step 1: Deploy or use existing dependencies
        // =====================================================================

        if (usdc == address(0)) {
            console.log("Deploying Mock USDC...");
            ERC20Mock _mockUsdc = new ERC20Mock("USD Coin (Mock)", "USDC", 6);
            mockUsdc = address(_mockUsdc);
            usdc = mockUsdc;
            console.log("  Mock USDC:", mockUsdc);
        } else {
            console.log("Using existing USDC:", usdc);
        }

        if (erc8004Registry == address(0)) {
            console.log("Deploying Mock ERC-8004 Registry...");
            ERC8004RegistryMock _mockRegistry = new ERC8004RegistryMock();
            mockErc8004Registry = address(_mockRegistry);
            erc8004Registry = mockErc8004Registry;
            console.log("  Mock ERC-8004 Registry:", mockErc8004Registry);
        } else {
            console.log("Using existing ERC-8004 Registry:", erc8004Registry);
        }

        console.log("");

        // =====================================================================
        // Step 2: Deploy MVP contracts (or use existing in upgrade mode)
        // =====================================================================

        if (upgradeMode) {
            console.log("UPGRADE MODE: Using existing MVP contracts");
            collateralVault = existingCollateralVault;
            termsRegistry = existingTermsRegistry;
            trustfulValidator = existingTrustfulValidator;
            console.log("  CollateralVault:", collateralVault);
            console.log("  TermsRegistry:", termsRegistry);
            console.log("  TrustfulValidator:", trustfulValidator);
        } else {
            console.log("Deploying MVP contracts...");

            console.log("Deploying CollateralVault...");
            CollateralVault _vault = new CollateralVault(
                usdc,
                erc8004Registry,
                governance,
                withdrawalGracePeriod
            );
            collateralVault = address(_vault);
            console.log("  CollateralVault:", collateralVault);

            console.log("Deploying TermsRegistry...");
            TermsRegistry _terms = new TermsRegistry(erc8004Registry, governance);
            termsRegistry = address(_terms);
            console.log("  TermsRegistry:", termsRegistry);

            console.log("Deploying TrustfulValidator...");
            TrustfulValidator _validator = new TrustfulValidator(
                erc8004Registry,
                governance,
                validationBaseUri
            );
            trustfulValidator = address(_validator);
            console.log("  TrustfulValidator:", trustfulValidator);
        }

        console.log("");

        // =====================================================================
        // Step 3: Deploy Phase 1 addition contracts
        // =====================================================================

        console.log("Deploying Phase 1 contracts...");

        console.log("Deploying CouncilRegistry...");
        CouncilRegistry _council = new CouncilRegistry(governance);
        councilRegistry = address(_council);
        console.log("  CouncilRegistry:", councilRegistry);

        console.log("Deploying ClaimsManager...");
        ClaimsManager _claims = new ClaimsManager(usdc, erc8004Registry, governance);
        claimsManager = address(_claims);
        console.log("  ClaimsManager:", claimsManager);

        console.log("Deploying RulingExecutor...");
        RulingExecutor _executor = new RulingExecutor(usdc, governance);
        rulingExecutor = address(_executor);
        console.log("  RulingExecutor:", rulingExecutor);

        console.log("");

        // =====================================================================
        // Step 4: Wire contracts together
        // =====================================================================

        console.log("Wiring contracts...");

        // 4.1 TrustfulValidator configuration
        TrustfulValidator trustfulValidatorContract = TrustfulValidator(trustfulValidator);
        if (!upgradeMode) {
            trustfulValidatorContract.setCollateralVault(collateralVault);
            trustfulValidatorContract.setTermsRegistry(termsRegistry);
            trustfulValidatorContract.setMinimumCollateral(minimumCollateral);
        }
        console.log("  TrustfulValidator wired");

        // 4.2 TermsRegistry configuration
        TermsRegistry termsRegistryContract = TermsRegistry(termsRegistry);
        if (!upgradeMode) {
            termsRegistryContract.setTrustfulValidator(trustfulValidator);
        }
        termsRegistryContract.setCouncilRegistry(councilRegistry);
        console.log("  TermsRegistry wired");

        // 4.3 CollateralVault configuration
        CollateralVault collateralVaultContract = CollateralVault(collateralVault);
        collateralVaultContract.setClaimsManager(claimsManager);
        collateralVaultContract.setRulingExecutor(rulingExecutor);
        console.log("  CollateralVault wired");

        // 4.4 CouncilRegistry configuration
        CouncilRegistry councilRegistryContract = CouncilRegistry(councilRegistry);
        councilRegistryContract.setTermsRegistry(termsRegistry);
        councilRegistryContract.setClaimsManager(claimsManager);
        console.log("  CouncilRegistry wired");

        // 4.5 ClaimsManager configuration
        ClaimsManager claimsManagerContract = ClaimsManager(claimsManager);
        claimsManagerContract.setCollateralVault(collateralVault);
        claimsManagerContract.setTermsRegistry(termsRegistry);
        claimsManagerContract.setCouncilRegistry(councilRegistry);
        claimsManagerContract.setRulingExecutor(rulingExecutor);
        console.log("  ClaimsManager wired");

        // 4.6 RulingExecutor configuration
        RulingExecutor rulingExecutorContract = RulingExecutor(rulingExecutor);
        rulingExecutorContract.setClaimsManager(claimsManager);
        rulingExecutorContract.setCollateralVault(collateralVault);
        rulingExecutorContract.setCouncilRegistry(councilRegistry);
        console.log("  RulingExecutor wired");

        vm.stopBroadcast();

        // =====================================================================
        // Step 5: Create default council (post-broadcast info)
        // =====================================================================

        console.log("");
        console.log("===========================================");
        console.log("  Post-Deployment Setup Required");
        console.log("===========================================");
        console.log("");
        console.log("Create a default council for disputes:");
        console.log("  cast send", councilRegistry);
        console.log("    \"createCouncil(string,string,string,uint256,uint256,uint256,uint256)\"");
        console.log("    \"General\" \"Default council for AI agent disputes\"");
        console.log("    \"general\" 5000 1000 604800 259200");
        console.log("    --rpc-url $RPC_URL --private-key $DEPLOYER_PRIVATE_KEY");
        console.log("");
        console.log("Parameters: name, description, vertical, quorumPct (50%), depositPct (10%), votingPeriod (7d), evidencePeriod (3d)");

        // =====================================================================
        // Summary
        // =====================================================================

        console.log("");
        console.log("===========================================");
        console.log("  Deployment Summary");
        console.log("===========================================");
        console.log("");
        console.log("Network:", _getNetworkName(block.chainid));
        console.log("Deployer:", deployer);
        console.log("Governance:", governance);
        console.log("");
        console.log("External Dependencies:");
        console.log("  USDC:", usdc, mockUsdc != address(0) ? "(mock)" : "");
        console.log("  ERC-8004 Registry:", erc8004Registry, mockErc8004Registry != address(0) ? "(mock)" : "");
        console.log("");
        console.log("MVP Contracts", upgradeMode ? "(existing)" : "(deployed):");
        console.log("  CollateralVault:", collateralVault);
        console.log("  TermsRegistry:", termsRegistry);
        console.log("  TrustfulValidator:", trustfulValidator);
        console.log("");
        console.log("Phase 1 Contracts (deployed):");
        console.log("  CouncilRegistry:", councilRegistry);
        console.log("  ClaimsManager:", claimsManager);
        console.log("  RulingExecutor:", rulingExecutor);
        console.log("");
        console.log("Configuration:");
        console.log("  Withdrawal Grace Period:", withdrawalGracePeriod / 1 days, "days");
        console.log("  Minimum Collateral:", minimumCollateral / 1e6, "USDC");
        console.log("  Validation Base URI:", validationBaseUri);
        console.log("");

        if (mockUsdc != address(0)) {
            console.log("===========================================");
            console.log("  Mock USDC Faucet");
            console.log("===========================================");
            console.log("");
            console.log("To mint test USDC:");
            console.log("  cast send", mockUsdc);
            console.log("    \"mint(address,uint256)\" YOUR_ADDRESS 10000000000");
            console.log("    --rpc-url $RPC_URL --private-key $PRIVATE_KEY");
            console.log("");
        }

        if (mockErc8004Registry != address(0)) {
            console.log("===========================================");
            console.log("  Mock ERC-8004 Registry");
            console.log("===========================================");
            console.log("");
            console.log("To mint a test agent:");
            console.log("  cast send", mockErc8004Registry);
            console.log("    \"mint(address,uint256)\" YOUR_ADDRESS 1");
            console.log("    --rpc-url $RPC_URL --private-key $PRIVATE_KEY");
            console.log("");
        }

        // Write deployment addresses to file
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

        // Build JSON - split to avoid stack too deep
        string memory part1 = string(abi.encodePacked(
            "{\n",
            '  "chainId": ', vm.toString(block.chainid), ",\n",
            '  "deployedAt": ', vm.toString(block.timestamp), ",\n",
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
            '  "rulingExecutor": "', vm.toString(rulingExecutor), '",\n'
        ));

        string memory part4 = string(abi.encodePacked(
            '  "mockUsdc": "', vm.toString(mockUsdc != address(0) ? mockUsdc : address(0)), '",\n',
            '  "mockErc8004Registry": "', vm.toString(mockErc8004Registry != address(0) ? mockErc8004Registry : address(0)), '"\n',
            "}"
        ));

        string memory json = string(abi.encodePacked(part1, part2, part3, part4));

        vm.writeFile(filename, json);
        console.log("Deployment addresses written to:", filename);
    }
}
