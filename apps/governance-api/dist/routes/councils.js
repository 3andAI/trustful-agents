import { Router } from 'express';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { requireAuth, requireSafeOwner } from '../middleware/auth.js';
import { validateBody, validateParams, addMemberSchema, updateMemberSchema, councilIdParamSchema, memberAddressParamSchema, } from '../middleware/validation.js';
import { getCouncilMember, getCouncilMembers, createCouncilMember, updateCouncilMember, deleteCouncilMember, logAuditEvent, } from '../services/members.js';
import { getAllAgents } from '../services/agents.js';
import { queueEmail } from '../services/email.js';
const router = Router();
// ============================================================================
// Configuration
// ============================================================================
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const COUNCIL_REGISTRY_ADDRESS = process.env.COUNCIL_REGISTRY_ADDRESS;
// Simplified ABI for read operations
const CouncilRegistryABI = [
    {
        type: 'function',
        name: 'getCouncil',
        inputs: [{ name: 'councilId', type: 'bytes32' }],
        outputs: [
            {
                name: 'council',
                type: 'tuple',
                components: [
                    { name: 'councilId', type: 'bytes32' },
                    { name: 'name', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'vertical', type: 'string' },
                    { name: 'memberCount', type: 'uint256' },
                    { name: 'quorumPercentage', type: 'uint256' },
                    { name: 'claimDepositPercentage', type: 'uint256' },
                    { name: 'votingPeriod', type: 'uint256' },
                    { name: 'evidencePeriod', type: 'uint256' },
                    { name: 'active', type: 'bool' },
                    { name: 'createdAt', type: 'uint256' },
                    { name: 'closedAt', type: 'uint256' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getActiveCouncils',
        inputs: [],
        outputs: [{ name: 'councilIds', type: 'bytes32[]' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getCouncilMembers',
        inputs: [{ name: 'councilId', type: 'bytes32' }],
        outputs: [{ name: 'members', type: 'address[]' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getMember',
        inputs: [
            { name: 'councilId', type: 'bytes32' },
            { name: 'member', type: 'address' },
        ],
        outputs: [
            {
                name: 'memberInfo',
                type: 'tuple',
                components: [
                    { name: 'member', type: 'address' },
                    { name: 'councilId', type: 'bytes32' },
                    { name: 'joinedAt', type: 'uint256' },
                    { name: 'claimsVoted', type: 'uint256' },
                    { name: 'active', type: 'bool' },
                ],
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'isActiveMember',
        inputs: [
            { name: 'councilId', type: 'bytes32' },
            { name: 'member', type: 'address' },
        ],
        outputs: [{ name: 'isMember', type: 'bool' }],
        stateMutability: 'view',
    },
];
// TermsRegistry ABI for getting agent terms
const TermsRegistryABI = [
    {
        type: 'function',
        name: 'getActiveTerms',
        inputs: [{ name: 'agentId', type: 'uint256' }],
        outputs: [
            {
                name: 'terms',
                type: 'tuple',
                components: [
                    { name: 'contentHash', type: 'bytes32' },
                    { name: 'contentUri', type: 'string' },
                    { name: 'councilId', type: 'bytes32' },
                    { name: 'registeredAt', type: 'uint256' },
                    { name: 'active', type: 'bool' },
                ],
            },
            { name: 'version', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
];
const TERMS_REGISTRY_ADDRESS = process.env.TERMS_REGISTRY_ADDRESS || '0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d';
// ============================================================================
// Viem Client
// ============================================================================
function getClient() {
    const chain = CHAIN_ID === 8453 ? base : baseSepolia;
    return createPublicClient({
        chain,
        transport: http(RPC_URL),
    });
}
// ============================================================================
// Routes
// ============================================================================
/**
 * GET /councils
 * List all active councils
 */
router.get('/', async (_req, res) => {
    try {
        const client = getClient();
        // Get active council IDs from chain
        const councilIds = await client.readContract({
            address: COUNCIL_REGISTRY_ADDRESS,
            abi: CouncilRegistryABI,
            functionName: 'getActiveCouncils',
        });
        // Fetch details for each council
        const councils = [];
        for (const councilId of councilIds) {
            const council = await client.readContract({
                address: COUNCIL_REGISTRY_ADDRESS,
                abi: CouncilRegistryABI,
                functionName: 'getCouncil',
                args: [councilId],
            });
            councils.push({
                councilId: council.councilId,
                name: council.name,
                description: council.description,
                vertical: council.vertical,
                memberCount: Number(council.memberCount),
                quorumPercentage: Number(council.quorumPercentage),
                claimDepositPercentage: Number(council.claimDepositPercentage),
                votingPeriod: Number(council.votingPeriod),
                evidencePeriod: Number(council.evidencePeriod),
                active: council.active,
                createdAt: Number(council.createdAt),
                closedAt: Number(council.closedAt),
            });
        }
        res.json(councils);
    }
    catch (error) {
        console.error('Failed to fetch councils:', error);
        res.status(500).json({ error: 'Failed to fetch councils' });
    }
});
/**
 * GET /councils/:id
 * Get council details
 */
router.get('/:id', validateParams(councilIdParamSchema), async (req, res) => {
    try {
        const councilId = req.params.id;
        const client = getClient();
        const council = await client.readContract({
            address: COUNCIL_REGISTRY_ADDRESS,
            abi: CouncilRegistryABI,
            functionName: 'getCouncil',
            args: [councilId],
        });
        if (Number(council.createdAt) === 0) {
            res.status(404).json({ error: 'Council not found' });
            return;
        }
        res.json({
            councilId: council.councilId,
            name: council.name,
            description: council.description,
            vertical: council.vertical,
            memberCount: Number(council.memberCount),
            quorumPercentage: Number(council.quorumPercentage),
            claimDepositPercentage: Number(council.claimDepositPercentage),
            votingPeriod: Number(council.votingPeriod),
            evidencePeriod: Number(council.evidencePeriod),
            active: council.active,
            createdAt: Number(council.createdAt),
            closedAt: Number(council.closedAt),
        });
    }
    catch (error) {
        console.error('Failed to fetch council:', error);
        res.status(500).json({ error: 'Failed to fetch council' });
    }
});
/**
 * GET /councils/:id/members
 * Get council members with off-chain metadata
 */
router.get('/:id/members', validateParams(councilIdParamSchema), async (req, res) => {
    try {
        const councilId = req.params.id;
        const client = getClient();
        // Get on-chain members
        const memberAddresses = await client.readContract({
            address: COUNCIL_REGISTRY_ADDRESS,
            abi: CouncilRegistryABI,
            functionName: 'getCouncilMembers',
            args: [councilId],
        });
        // Get off-chain metadata
        const dbMembers = await getCouncilMembers(councilId);
        const metadataMap = new Map(dbMembers.map((m) => [m.address.toLowerCase(), m]));
        // Combine on-chain and off-chain data
        const members = [];
        for (const address of memberAddresses) {
            const onChainMember = await client.readContract({
                address: COUNCIL_REGISTRY_ADDRESS,
                abi: CouncilRegistryABI,
                functionName: 'getMember',
                args: [councilId, address],
            });
            const metadata = metadataMap.get(address.toLowerCase());
            members.push({
                address: address,
                name: metadata?.name ?? null,
                description: metadata?.description ?? null,
                email: metadata?.email ?? null,
                joinedAt: Number(onChainMember.joinedAt),
                claimsVoted: Number(onChainMember.claimsVoted),
                active: onChainMember.active,
            });
        }
        res.json(members);
    }
    catch (error) {
        console.error('Failed to fetch council members:', error);
        res.status(500).json({ error: 'Failed to fetch council members' });
    }
});
/**
 * GET /councils/:id/agents
 * Get agents assigned to this council
 */
router.get('/:id/agents', validateParams(councilIdParamSchema), async (req, res) => {
    try {
        const councilId = req.params.id;
        const client = getClient();
        console.log(`Fetching agents for council ${councilId}`);
        // Get total supply of agents from ERC8004Registry
        const ERC8004_REGISTRY = process.env.ERC8004_REGISTRY_ADDRESS || '0xb3B4b5042Fd3600404846671Ff5558719860b694';
        const ERC8004ABI = [
            {
                type: 'function',
                name: 'totalSupply',
                inputs: [],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
            },
            {
                type: 'function',
                name: 'ownerOf',
                inputs: [{ name: 'tokenId', type: 'uint256' }],
                outputs: [{ name: '', type: 'address' }],
                stateMutability: 'view',
            },
        ];
        const totalSupply = await client.readContract({
            address: ERC8004_REGISTRY,
            abi: ERC8004ABI,
            functionName: 'totalSupply',
        });
        console.log(`Total agents: ${totalSupply}`);
        // Get DB metadata for all agents (for names)
        const allAgentsMetadata = await getAllAgents();
        const metadataMap = new Map(allAgentsMetadata.map(a => [a.agent_id, a]));
        // Check each agent's council assignment
        const assignedAgents = [];
        // Iterate through all agent IDs (1 to totalSupply, assuming 1-indexed)
        for (let i = 1; i <= Number(totalSupply); i++) {
            try {
                // Get terms for this agent
                const result = await client.readContract({
                    address: TERMS_REGISTRY_ADDRESS,
                    abi: TermsRegistryABI,
                    functionName: 'getActiveTerms',
                    args: [BigInt(i)],
                });
                const terms = result[0];
                console.log(`Agent ${i}: active=${terms.active}, councilId=${terms.councilId}`);
                if (terms.active && terms.councilId.toLowerCase() === councilId.toLowerCase()) {
                    // Get owner
                    let ownerAddress = '';
                    try {
                        ownerAddress = await client.readContract({
                            address: ERC8004_REGISTRY,
                            abi: ERC8004ABI,
                            functionName: 'ownerOf',
                            args: [BigInt(i)],
                        });
                    }
                    catch {
                        ownerAddress = 'unknown';
                    }
                    const metadata = metadataMap.get(String(i));
                    assignedAgents.push({
                        agentId: String(i),
                        name: metadata?.name ?? `Agent #${i}`,
                        description: metadata?.description ?? null,
                        ownerAddress: ownerAddress,
                    });
                }
            }
            catch (err) {
                // Agent may not have terms registered, skip
                console.log(`Agent ${i}: no terms or error`);
            }
        }
        console.log(`Found ${assignedAgents.length} agents for council ${councilId}`);
        res.json({
            councilId,
            agents: assignedAgents,
            count: assignedAgents.length,
        });
    }
    catch (error) {
        console.error('Failed to fetch council agents:', error);
        res.status(500).json({ error: 'Failed to fetch council agents' });
    }
});
/**
 * POST /councils/:id/members
 * Add a council member (creates Safe transaction)
 * NOTE: This only saves metadata - actual on-chain add requires Safe TX execution
 */
router.post('/:id/members', requireAuth, requireSafeOwner, validateParams(councilIdParamSchema), validateBody(addMemberSchema), async (req, res) => {
    try {
        const councilId = req.params.id;
        const { address, name, description, email } = req.body;
        // Save metadata to database (will sync with on-chain after Safe TX executes)
        const member = await createCouncilMember(councilId, address, name, description, email);
        // Log audit event
        await logAuditEvent('member_added', req.session.address, 'member', `${councilId}:${address}`, { name, description, email });
        // Send welcome email if email provided
        if (email) {
            // Get council name for email
            const client = getClient();
            const council = await client.readContract({
                address: COUNCIL_REGISTRY_ADDRESS,
                abi: CouncilRegistryABI,
                functionName: 'getCouncil',
                args: [councilId],
            });
            await queueEmail(email, 'member_added', {
                councilName: council.name,
                memberAddress: address,
                addedBy: req.session.address,
                dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
            });
        }
        res.status(201).json({
            address: member.address,
            name: member.name,
            description: member.description,
            email: member.email,
            message: 'Member metadata saved. Create Safe transaction to add member on-chain.',
        });
    }
    catch (error) {
        console.error('Failed to add member:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});
/**
 * PUT /councils/:id/members/:address
 * Update member metadata (off-chain only)
 */
router.put('/:id/members/:address', requireAuth, requireSafeOwner, validateParams(memberAddressParamSchema), validateBody(updateMemberSchema), async (req, res) => {
    try {
        const { id: councilId, address } = req.params;
        const { name, description, email } = req.body;
        const updated = await updateCouncilMember(councilId, address, {
            name,
            description,
            email,
        });
        if (!updated) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        // Log audit event
        await logAuditEvent('member_metadata_updated', req.session.address, 'member', `${councilId}:${address}`, { name, description, email });
        res.json({
            address: updated.address,
            name: updated.name,
            description: updated.description,
            email: updated.email,
        });
    }
    catch (error) {
        console.error('Failed to update member:', error);
        res.status(500).json({ error: 'Failed to update member' });
    }
});
/**
 * DELETE /councils/:id/members/:address
 * Remove a council member (creates Safe transaction)
 * NOTE: This only removes metadata - actual on-chain remove requires Safe TX execution
 */
router.delete('/:id/members/:address', requireAuth, requireSafeOwner, validateParams(memberAddressParamSchema), async (req, res) => {
    try {
        const { id: councilId, address } = req.params;
        // Get member email before deletion
        const member = await getCouncilMember(councilId, address);
        // Delete from database
        const deleted = await deleteCouncilMember(councilId, address);
        if (!deleted) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        // Log audit event
        await logAuditEvent('member_removed', req.session.address, 'member', `${councilId}:${address}`, {});
        // Send removal notification if email was stored
        if (member?.email) {
            const client = getClient();
            const council = await client.readContract({
                address: COUNCIL_REGISTRY_ADDRESS,
                abi: CouncilRegistryABI,
                functionName: 'getCouncil',
                args: [councilId],
            });
            await queueEmail(member.email, 'member_removed', {
                councilName: council.name,
                removedBy: req.session.address,
                reason: 'Removed by governance',
            });
        }
        res.json({
            success: true,
            message: 'Member metadata removed. Create Safe transaction to remove member on-chain.',
        });
    }
    catch (error) {
        console.error('Failed to remove member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});
export default router;
//# sourceMappingURL=councils.js.map