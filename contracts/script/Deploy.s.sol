// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

/**
 * @title Deploy
 * @notice Deploys all Trustful Agents contracts
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
 */
contract Deploy is Script {
    // Deployed addresses (populated during deployment)
    address public collateralVault;
    address public termsRegistry;
    address public trustfulValidator;
    address public councilRegistry;
    address public claimsManager;
    address public rulingExecutor;
    address public pauseController;

    // Configuration from environment
    address public usdc;
    address public erc8004Registry;
    uint256 public withdrawalGracePeriod;
    uint256 public minimumCollateral;

    function setUp() public {
        // Load configuration from environment
        usdc = vm.envAddress("USDC_ADDRESS");
        erc8004Registry = vm.envOr("ERC8004_REGISTRY_ADDRESS", address(0));
        withdrawalGracePeriod = vm.envOr("WITHDRAWAL_GRACE_PERIOD", uint256(7 days));
        minimumCollateral = vm.envOr("MIN_COLLATERAL_AMOUNT", uint256(100e6)); // 100 USDC
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying Trustful Agents contracts...");
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);
        console.log("ERC-8004 Registry:", erc8004Registry);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy TrustfulPausable (access control)
        // pauseController = address(new TrustfulPausable(deployer));
        // console.log("TrustfulPausable:", pauseController);

        // 2. Deploy CollateralVault
        // collateralVault = address(new CollateralVault(
        //     usdc,
        //     erc8004Registry,
        //     withdrawalGracePeriod
        // ));
        // console.log("CollateralVault:", collateralVault);

        // 3. Deploy TermsRegistry
        // termsRegistry = address(new TermsRegistry(erc8004Registry));
        // console.log("TermsRegistry:", termsRegistry);

        // 4. Deploy CouncilRegistry
        // councilRegistry = address(new CouncilRegistry());
        // console.log("CouncilRegistry:", councilRegistry);

        // 5. Deploy ClaimsManager
        // claimsManager = address(new ClaimsManager(
        //     collateralVault,
        //     termsRegistry,
        //     councilRegistry,
        //     usdc
        // ));
        // console.log("ClaimsManager:", claimsManager);

        // 6. Deploy RulingExecutor
        // rulingExecutor = address(new RulingExecutor(
        //     claimsManager,
        //     collateralVault,
        //     councilRegistry
        // ));
        // console.log("RulingExecutor:", rulingExecutor);

        // 7. Deploy TrustfulValidator
        // trustfulValidator = address(new TrustfulValidator(
        //     erc8004Registry,
        //     collateralVault,
        //     termsRegistry,
        //     minimumCollateral
        // ));
        // console.log("TrustfulValidator:", trustfulValidator);

        // 8. Configure permissions
        // CollateralVault(collateralVault).setClaimsManager(claimsManager);
        // CollateralVault(collateralVault).setRulingExecutor(rulingExecutor);
        // ClaimsManager(claimsManager).setRulingExecutor(rulingExecutor);

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        // console.log("TrustfulPausable:", pauseController);
        // console.log("CollateralVault:", collateralVault);
        // console.log("TermsRegistry:", termsRegistry);
        // console.log("CouncilRegistry:", councilRegistry);
        // console.log("ClaimsManager:", claimsManager);
        // console.log("RulingExecutor:", rulingExecutor);
        // console.log("TrustfulValidator:", trustfulValidator);

        console.log("\nNOTE: Contract implementations not yet created.");
        console.log("This script will be updated as contracts are implemented.");
    }
}
