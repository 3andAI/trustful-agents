export declare const NETWORK: "base-sepolia";
export declare const CHAIN_ID: 84532;
export declare const RPC_URL = "https://sepolia.base.org";
export declare const BLOCK_EXPLORER_URL = "https://sepolia.basescan.org";
export declare const START_BLOCK = 36873479;
export declare const CONTRACTS: {
    readonly usdc: "0xd6897C4801c639Ff4eAaA31D7A5b4802613DB681";
    readonly erc8004Registry: "0x454909C7551158e12a6a5192dEB359dDF067ec80";
    readonly collateralVault: "0xC948389425061c2C960c034c1c9526E9E6f39ff9";
    readonly termsRegistry: "0xBDc5328D4442A1e893CD2b1F75d3F64a3e50f923";
    readonly councilRegistry: "0xAaA608c80168D90d77Ec5a7f72Fb939E7Add5C32";
    readonly trustfulValidator: "0x9628C1bD875C3378B14f0108b60B0b5739fE92E8";
    readonly claimsManager: "0x7B0465DF41c3649f88A627cF06941469BE9C7a44";
    readonly rulingExecutor: "0x2a49b1826810AefAfFf93eC9317A426BbF8DC11f";
};
export declare const USDC_ADDRESS: "0xd6897C4801c639Ff4eAaA31D7A5b4802613DB681";
export declare const ERC8004_REGISTRY_ADDRESS: "0x454909C7551158e12a6a5192dEB359dDF067ec80";
export declare const COLLATERAL_VAULT_ADDRESS: "0xC948389425061c2C960c034c1c9526E9E6f39ff9";
export declare const TERMS_REGISTRY_ADDRESS: "0xBDc5328D4442A1e893CD2b1F75d3F64a3e50f923";
export declare const COUNCIL_REGISTRY_ADDRESS: "0xAaA608c80168D90d77Ec5a7f72Fb939E7Add5C32";
export declare const TRUSTFUL_VALIDATOR_ADDRESS: "0x9628C1bD875C3378B14f0108b60B0b5739fE92E8";
export declare const CLAIMS_MANAGER_ADDRESS: "0x7B0465DF41c3649f88A627cF06941469BE9C7a44";
export declare const RULING_EXECUTOR_ADDRESS: "0x2a49b1826810AefAfFf93eC9317A426BbF8DC11f";
export declare const SAFE_ADDRESS: "0x568A391C188e2aF11FA7550ACca170e085B00e7F";
export declare const SAFE_TX_SERVICE_URL = "https://safe-transaction-base-sepolia.safe.global";
export declare const SAFE_APP_URL = "https://app.safe.global";
export declare const SAFE_NETWORK_PREFIX = "basesep";
export declare const API_URL = "https://api.trustful-agents.ai";
export declare const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1723244/trustful-agents/v1.3.1";
export declare const SUBGRAPH_VERSION = "v1.3.1";
export declare const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";
export declare const DASHBOARD_URLS: {
    readonly provider: "https://provider.trustful-agents.ai";
    readonly claimer: "https://claims.trustful-agents.ai";
    readonly council: "https://council.trustful-agents.ai";
    readonly governance: "https://governance.trustful-agents.ai";
};
export declare const DATABASE_NAME = "trustful_governance_sepolia";
export declare const DATABASE_PORT = 5432;
export declare const USDC_DECIMALS = 6;
export declare const USDC_SYMBOL = "USDC";
export declare const ClaimsManagerAbi: readonly [{
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimFiled";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "claimant";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "claimedAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "claimantDeposit";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "EvidenceSubmitted";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "evidenceHash";
        readonly type: "bytes32";
        readonly indexed: false;
    }, {
        readonly name: "evidenceUri";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "isCounterEvidence";
        readonly type: "bool";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "VoteCast";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "voter";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "vote";
        readonly type: "uint8";
        readonly indexed: false;
    }, {
        readonly name: "approvedAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "VoteChanged";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "voter";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "oldVote";
        readonly type: "uint8";
        readonly indexed: false;
    }, {
        readonly name: "newVote";
        readonly type: "uint8";
        readonly indexed: false;
    }, {
        readonly name: "oldApprovedAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "newApprovedAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimApproved";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "approvedAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimRejected";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimCancelled";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "depositForfeited";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimExpired";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "hadVotes";
        readonly type: "bool";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimExecuted";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "amountPaid";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}];
export declare const CollateralVaultAbi: readonly [{
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "Deposited";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "depositor";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "WithdrawalInitiated";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "executeAfter";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "WithdrawalCancelled";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "WithdrawalExecuted";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "recipient";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CollateralLocked";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CollateralUnlocked";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CollateralSlashed";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "recipient";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}];
export declare const CouncilRegistryAbi: readonly [{
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CouncilCreated";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "name";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "vertical";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "quorumPercentage";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "claimDepositPercentage";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CouncilClosed";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "timestamp";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CouncilUpdated";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CouncilDeactivated";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CouncilActivated";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "MemberAdded";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "member";
        readonly type: "address";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "MemberRemoved";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "member";
        readonly type: "address";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "MemberSuspended";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "member";
        readonly type: "address";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "MemberReinstated";
    readonly inputs: readonly [{
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "member";
        readonly type: "address";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "AgentCouncilReassigned";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "oldCouncilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "newCouncilId";
        readonly type: "bytes32";
        readonly indexed: true;
    }];
}];
export declare const ERC8004RegistryAbi: readonly [{
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "mintAuto";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "ownerOf";
    readonly inputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "balanceOf";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "nextTokenId";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "totalSupply";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "tokenOfOwnerByIndex";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "index";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "tokenURI";
    readonly inputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "Transfer";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly indexed: true;
    }];
}];
export declare const RulingExecutorAbi: readonly [{
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ClaimExecuted";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "claimant";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "compensationAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "councilFee";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "DepositDistributed";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "voterCount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "totalAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "amountPerVoter";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "DepositReturned";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "claimant";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "reason";
        readonly type: "string";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "CollateralUnlocked";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "PartialExecution";
    readonly inputs: readonly [{
        readonly name: "claimId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "requestedAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "actualAmount";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "reason";
        readonly type: "string";
        readonly indexed: false;
    }];
}];
export declare const TermsRegistryAbi: readonly [{
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "TermsRegistered";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "version";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "contentHash";
        readonly type: "bytes32";
        readonly indexed: false;
    }, {
        readonly name: "contentUri";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "councilId";
        readonly type: "bytes32";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "TermsActivated";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "version";
        readonly type: "uint256";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "TermsDeactivated";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "version";
        readonly type: "uint256";
        readonly indexed: true;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "TermsInvalidated";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "reason";
        readonly type: "string";
        readonly indexed: false;
    }];
}];
export declare const TrustfulValidatorAbi: readonly [{
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ValidationIssued";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "requestHash";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "responseUri";
        readonly type: "string";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ValidationRevoked";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "requestHash";
        readonly type: "bytes32";
        readonly indexed: true;
    }, {
        readonly name: "reason";
        readonly type: "uint8";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly anonymous: false;
    readonly name: "ValidationConditionsChanged";
    readonly inputs: readonly [{
        readonly name: "agentId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "conditions";
        readonly type: "tuple";
        readonly indexed: false;
        readonly components: readonly [{
            readonly name: "hasMinimumCollateral";
            readonly type: "bool";
        }, {
            readonly name: "hasActiveTerms";
            readonly type: "bool";
        }, {
            readonly name: "isOwnerValid";
            readonly type: "bool";
        }, {
            readonly name: "councilIsActive";
            readonly type: "bool";
        }];
    }];
}];
export declare const USDCAbi: readonly [{
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "approve";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "balanceOf";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "allowance";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "decimals";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "totalSupply";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "transfer";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferFrom";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "Transfer";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "Approval";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "spender";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}];
export declare const MockUsdcAbi: readonly [{
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "approve";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "balanceOf";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "allowance";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "spender";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "decimals";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "totalSupply";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "transfer";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferFrom";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "Transfer";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "Approval";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "spender";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "value";
        readonly type: "uint256";
        readonly indexed: false;
    }];
}];
export declare const Erc8004RegistryAbi: readonly [{
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "mintAuto";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "ownerOf";
    readonly inputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "balanceOf";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "nextTokenId";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "totalSupply";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "tokenOfOwnerByIndex";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "index";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "tokenURI";
    readonly inputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "Transfer";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly indexed: true;
    }];
}];
//# sourceMappingURL=contracts.d.ts.map