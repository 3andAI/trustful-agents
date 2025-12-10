// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { CollateralVault } from "../src/core/CollateralVault.sol";
import { TermsRegistry } from "../src/core/TermsRegistry.sol";
import { TrustfulValidator } from "../src/core/TrustfulValidator.sol";
import { ERC20Mock } from "../test/mocks/ERC20Mock.sol";
import { ERC8004RegistryMock } from "../test/mocks/ERC8004RegistryMock.sol";

/**
 * @title DeployMVP
 * @notice Deploys the minimal MVP: CollateralVault, TermsRegistry, TrustfulValidator
 * @dev Includes mock USDC and ERC-8004 registry for testnet
 *
 * Run with:
 *   forge script script/DeployMVP.s.sol:DeployMVP \
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
 *   - USDC_ADDRESS: Existing USDC address (deploys mock if not set)
 *   - ERC8004_REGISTRY_ADDRESS: Existing registry (deploys mock if not set)
 *   - WITHDRAWAL_GRACE_PERIOD: Grace period in seconds (default: 7 days)
 *   - MIN_COLLATERAL_AMOUNT: Minimum collateral in USDC units (default: 100e6)
 *   - VALIDATION_BASE_URI: Base URI for validation responses
 */
contract DeployMVP is Script {
    // =========================================================================
    // Deployed Addresses
    // =========================================================================

    // Mocks (only deployed if not provided)
    address public mockUsdc;
    address public mockErc8004Registry;

    // Core contracts
    address public collateralVault;
    address public termsRegistry;
    address public trustfulValidator;

    // =========================================================================
    // Configuration
    // =========================================================================

    address public usdc;
    address public erc8004Registry;
    address public governance;
    uint256 public withdrawalGracePeriod;
    uint256 public minimumCollateral;
    string public validationBaseUri;

    function setUp() public {
        // Load configuration from environment
        usdc = vm.envOr("USDC_ADDRESS", address(0));
        erc8004Registry = vm.envOr("ERC8004_REGISTRY_ADDRESS", address(0));
        withdrawalGracePeriod = vm.envOr("WITHDRAWAL_GRACE_PERIOD", uint256(7 days));
        minimumCollateral = vm.envOr("MIN_COLLATERAL_AMOUNT", uint256(100e6)); // 100 USDC
        validationBaseUri = vm.envOr("VALIDATION_BASE_URI", string("https://trustful.ai/v/"));
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        governance = deployer; // For MVP, deployer is governance

        console.log("===========================================");
        console.log("  Trustful Agents MVP Deployment");
        console.log("===========================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // =====================================================================
        // Step 1: Deploy or use existing mocks
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
        // Step 2: Deploy Core Contracts
        // =====================================================================

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

        console.log("");

        // =====================================================================
        // Step 3: Configure Contracts
        // =====================================================================

        console.log("Configuring contracts...");

        // Configure TrustfulValidator
        _validator.setCollateralVault(collateralVault);
        _validator.setTermsRegistry(termsRegistry);
        _validator.setMinimumCollateral(minimumCollateral);
        console.log("  TrustfulValidator configured");

        // Configure TermsRegistry
        _terms.setTrustfulValidator(trustfulValidator);
        console.log("  TermsRegistry configured");

        // Note: CollateralVault claimsManager and rulingExecutor not set (MVP)

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
        console.log("Deployer/Governance:", deployer);
        console.log("");
        console.log("External Dependencies:");
        console.log("  USDC:", usdc, mockUsdc != address(0) ? "(mock)" : "");
        console.log("  ERC-8004 Registry:", erc8004Registry, mockErc8004Registry != address(0) ? "(mock)" : "");
        console.log("");
        console.log("Core Contracts:");
        console.log("  CollateralVault:", collateralVault);
        console.log("  TermsRegistry:", termsRegistry);
        console.log("  TrustfulValidator:", trustfulValidator);
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
            console.log("To mint test USDC, call:");
            console.log("  MockUSDC.mint(yourAddress, amount)");
            console.log("");
            console.log("Example (cast):");
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
            console.log("To mint a test agent, call:");
            console.log("  MockRegistry.mint(ownerAddress, agentId)");
            console.log("");
            console.log("Example (cast):");
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

        // Build JSON in parts to avoid stack too deep
        string memory part1 = string(abi.encodePacked(
            "{\n",
            '  "chainId": ', vm.toString(block.chainid), ",\n",
            '  "usdc": "', vm.toString(usdc), '",\n',
            '  "erc8004Registry": "', vm.toString(erc8004Registry), '",\n'
        ));

        string memory part2 = string(abi.encodePacked(
            '  "collateralVault": "', vm.toString(collateralVault), '",\n',
            '  "termsRegistry": "', vm.toString(termsRegistry), '",\n',
            '  "trustfulValidator": "', vm.toString(trustfulValidator), '",\n'
        ));

        string memory part3 = string(abi.encodePacked(
            '  "mockUsdc": "', vm.toString(mockUsdc), '",\n',
            '  "mockErc8004Registry": "', vm.toString(mockErc8004Registry), '"\n',
            "}"
        ));

        string memory json = string(abi.encodePacked(part1, part2, part3));

        // forge-lint: disable-next-line unsafe-cheatcode
        vm.writeFile(filename, json);
        console.log("Deployment addresses written to:", filename);
    }
}
