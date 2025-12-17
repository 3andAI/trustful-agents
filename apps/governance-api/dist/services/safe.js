import SafeApiKitModule from '@safe-global/api-kit';
import SafeModule from '@safe-global/protocol-kit';
import { OperationType, } from '@safe-global/types-kit';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
// Type workaround for default exports
const SafeApiKit = SafeApiKitModule;
const Safe = SafeModule;
// ============================================================================
// Configuration
// ============================================================================
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
// ============================================================================
// Clients
// ============================================================================
let apiKit = null;
// Safe Transaction Service URLs (without trailing slash)
const SAFE_TX_SERVICE_URLS = {
    8453: 'https://safe-transaction-base.safe.global',
    84532: 'https://safe-transaction-base-sepolia.safe.global',
};
function getApiKit() {
    if (!apiKit) {
        const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
        if (!txServiceUrl) {
            throw new Error(`No Safe Transaction Service URL for chain ${CHAIN_ID}`);
        }
        apiKit = new SafeApiKit({
            chainId: BigInt(CHAIN_ID),
            txServiceUrl,
        });
    }
    return apiKit;
}
function getViemClient() {
    const chain = CHAIN_ID === 8453 ? base : baseSepolia;
    return createPublicClient({
        chain,
        transport: http(RPC_URL),
    });
}
export async function getSafeInfo() {
    // Use direct fetch with redirect follow (SDK doesn't handle 308 redirects)
    const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
    const url = `${txServiceUrl}/api/v1/safes/${SAFE_ADDRESS}`;
    const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Safe API error: ${response.status} ${response.statusText}`);
    }
    const info = await response.json();
    return {
        address: info.address,
        threshold: info.threshold,
        owners: info.owners,
        nonce: parseInt(info.nonce, 10),
    };
}
export async function getSafeOwners() {
    const info = await getSafeInfo();
    return info.owners.map((o) => o.toLowerCase());
}
export async function isSafeOwner(address) {
    const owners = await getSafeOwners();
    return owners.includes(address.toLowerCase());
}
// ============================================================================
// Transaction Management
// ============================================================================
export async function getPendingTransactions() {
    const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
    const url = `${txServiceUrl}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?executed=false&nonce__gte=0`;
    const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`Safe API error: ${response.status}`);
    }
    const data = await response.json();
    return (data.results || []).map((tx) => ({
        safeTxHash: tx.safeTxHash,
        to: tx.to,
        data: tx.data || '0x',
        value: tx.value,
        operation: tx.operation,
        nonce: tx.nonce,
        confirmations: tx.confirmations?.length || 0,
        confirmationsRequired: tx.confirmationsRequired,
        isExecuted: tx.isExecuted,
        proposer: tx.proposer || '',
        description: parseTransactionDescription(tx.to, tx.data || '0x'),
    }));
}
export async function getTransaction(safeTxHash) {
    try {
        const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
        const url = `${txServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`;
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
            return null;
        }
        const tx = await response.json();
        return {
            safeTxHash: tx.safeTxHash,
            to: tx.to,
            data: tx.data || '0x',
            value: tx.value,
            operation: tx.operation,
            nonce: tx.nonce,
            confirmations: tx.confirmations?.length || 0,
            confirmationsRequired: tx.confirmationsRequired,
            isExecuted: tx.isExecuted,
            proposer: tx.proposer || '',
            description: parseTransactionDescription(tx.to, tx.data || '0x'),
        };
    }
    catch {
        return null;
    }
}
export async function proposeTransaction(params) {
    const { to, data, value = '0', signerAddress } = params;
    const kit = getApiKit();
    // Create transaction data
    const safeTransactionData = {
        to,
        data,
        value,
        operation: OperationType.Call,
    };
    // If we have a private key, we can sign server-side
    // Otherwise, return unsigned transaction for client-side signing
    if (params.signerPrivateKey) {
        // Initialize Safe with signer (protocol-kit v6)
        const protocolKit = await Safe.init({
            provider: RPC_URL,
            signer: params.signerPrivateKey,
            safeAddress: SAFE_ADDRESS,
        });
        // Create transaction
        const safeTransaction = await protocolKit.createTransaction({
            transactions: [safeTransactionData],
        });
        // Sign transaction
        const signedTransaction = await protocolKit.signTransaction(safeTransaction);
        // Get transaction hash
        const safeTxHash = await protocolKit.getTransactionHash(signedTransaction);
        // Get signature for the signer
        const signerSignature = signedTransaction.getSignature(signerAddress.toLowerCase());
        // Propose to Safe Transaction Service
        await kit.proposeTransaction({
            safeAddress: SAFE_ADDRESS,
            safeTransactionData: signedTransaction.data,
            safeTxHash,
            senderAddress: signerAddress,
            senderSignature: signerSignature?.data || '',
        });
        return safeTxHash;
    }
    // For client-side signing, we need to return the transaction data
    // The client will sign and submit
    throw new Error('Client-side signing not yet implemented - provide signerPrivateKey');
}
// ============================================================================
// Transaction Signing
// ============================================================================
export async function signTransaction(safeTxHash, signerPrivateKey, signerAddress) {
    const kit = getApiKit();
    // Get the transaction
    const tx = await kit.getTransaction(safeTxHash);
    // Initialize Safe with signer
    const protocolKit = await Safe.init({
        provider: RPC_URL,
        signer: signerPrivateKey,
        safeAddress: SAFE_ADDRESS,
    });
    // Create Safe transaction from existing data
    const safeTransaction = await protocolKit.createTransaction({
        transactions: [{
                to: tx.to,
                data: tx.data || '0x',
                value: tx.value,
                operation: tx.operation,
            }],
    });
    // Sign the hash
    const signature = await protocolKit.signHash(safeTxHash);
    // Submit confirmation
    await kit.confirmTransaction(safeTxHash, signature.data);
}
// ============================================================================
// Transaction Helpers
// ============================================================================
// Known function selectors for governance actions
const FUNCTION_SELECTORS = {
    '0x3d91a2a1': 'createCouncil',
    '0x8456cb59': 'closeCouncil',
    '0x0d8e6e2c': 'addMember',
    '0x0b1ca49a': 'removeMember',
    '0x7f6d4b4a': 'reassignAgentCouncil',
    '0x5c975abb': 'pause',
    '0x3f4ba83a': 'unpause',
};
function parseTransactionDescription(to, data) {
    if (data.length < 10)
        return 'Unknown transaction';
    const selector = data.slice(0, 10);
    const functionName = FUNCTION_SELECTORS[selector];
    if (functionName) {
        return `${functionName} on ${to.slice(0, 10)}...`;
    }
    return `Call to ${to.slice(0, 10)}...`;
}
// ============================================================================
// Governance Contract Helpers
// ============================================================================
export function encodeCreateCouncil(name, description, vertical, quorumPercentage, claimDepositPercentage, votingPeriod, evidencePeriod) {
    // ABI encode createCouncil call
    // createCouncil(string,string,string,uint256,uint256,uint256,uint256)
    const client = getViemClient();
    // We'd need the full ABI here - simplified for now
    // In production, import the actual ABI from the SDK
    return '0x';
}
export function encodeAddMember(councilId, member) {
    // ABI encode addMember call
    return '0x';
}
export function encodeRemoveMember(councilId, member) {
    // ABI encode removeMember call  
    return '0x';
}
export function encodeReassignAgent(agentId, newCouncilId) {
    // ABI encode reassignAgentCouncil call
    return '0x';
}
// ============================================================================
// Health Check
// ============================================================================
export async function healthCheck() {
    try {
        await getSafeInfo();
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=safe.js.map