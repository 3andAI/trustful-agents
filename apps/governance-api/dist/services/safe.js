import SafeApiKitModule from '@safe-global/api-kit';
import SafeModule from '@safe-global/protocol-kit';
import { OperationType, } from '@safe-global/types-kit';
import { getAddress } from 'viem';
import { CHAIN_ID, SAFE_ADDRESS, SAFE_TX_SERVICE_URL, RPC_URL, publicClient, } from '../config/index.js';
// Type workaround for default exports
const SafeApiKit = SafeApiKitModule;
const Safe = SafeModule;
// ============================================================================
// Safe Contract ABI (minimal for reading owners/threshold)
// ============================================================================
const SAFE_ABI = [
    {
        name: 'getOwners',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address[]' }],
        stateMutability: 'view',
    },
    {
        name: 'getThreshold',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        name: 'nonce',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
];
// ============================================================================
// Clients
// ============================================================================
let apiKit = null;
// Cache for Safe info (avoids API rate limits)
let cachedSafeInfo = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
function getApiKit() {
    if (!apiKit) {
        apiKit = new SafeApiKit({
            chainId: BigInt(CHAIN_ID),
            txServiceUrl: SAFE_TX_SERVICE_URL,
        });
    }
    return apiKit;
}
// ============================================================================
// Safe Info - Read from Contract (no API calls)
// ============================================================================
export async function getSafeInfo() {
    // Return cached if valid
    if (cachedSafeInfo && (Date.now() - cacheTime) < CACHE_TTL) {
        return cachedSafeInfo;
    }
    // Validate SAFE_ADDRESS is configured
    if (!SAFE_ADDRESS) {
        throw new Error('SAFE_ADDRESS is not configured');
    }
    try {
        // Read directly from Safe contract (no API rate limits)
        const [owners, threshold, nonce] = await Promise.all([
            publicClient.readContract({
                address: SAFE_ADDRESS,
                abi: SAFE_ABI,
                functionName: 'getOwners',
            }),
            publicClient.readContract({
                address: SAFE_ADDRESS,
                abi: SAFE_ABI,
                functionName: 'getThreshold',
            }),
            publicClient.readContract({
                address: SAFE_ADDRESS,
                abi: SAFE_ABI,
                functionName: 'nonce',
            }),
        ]);
        const info = {
            address: getAddress(SAFE_ADDRESS),
            threshold: Number(threshold),
            owners: owners.map((o) => getAddress(o)),
            nonce: Number(nonce),
        };
        // Cache the result
        cachedSafeInfo = info;
        cacheTime = Date.now();
        return info;
    }
    catch (rpcError) {
        console.error('RPC call to Safe contract failed:', rpcError);
        // Fallback to Safe Transaction Service API
        console.log('Falling back to Safe Transaction Service API...');
        try {
            const response = await fetch(`${SAFE_TX_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/`, {
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`Safe API returned ${response.status}`);
            }
            const data = await response.json();
            const info = {
                address: getAddress(data.address),
                threshold: data.threshold,
                owners: data.owners.map((o) => getAddress(o)),
                nonce: data.nonce,
            };
            // Cache the result
            cachedSafeInfo = info;
            cacheTime = Date.now();
            return info;
        }
        catch (apiError) {
            console.error('Safe API fallback also failed:', apiError);
            throw new Error(`Could not fetch Safe info: RPC and API both failed. RPC error: ${rpcError}`);
        }
    }
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
    const url = `${SAFE_TX_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?executed=false&nonce__gte=0`;
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
        const url = `${SAFE_TX_SERVICE_URL}/api/v1/multisig-transactions/${safeTxHash}/`;
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
    return '0x';
}
export function encodeAddMember(councilId, member) {
    return '0x';
}
export function encodeRemoveMember(councilId, member) {
    return '0x';
}
export function encodeReassignAgent(agentId, newCouncilId) {
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