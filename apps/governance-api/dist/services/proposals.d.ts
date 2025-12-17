import type { Proposal, Vote, ProposalType, ProposalStatus, VoteChoice } from '../types/index.js';
export declare function createProposal(type: ProposalType, proposerAddress: string, threshold: number, data: {
    councilName?: string;
    councilDescription?: string;
    councilVertical?: string;
    councilId?: string;
    memberAddress?: string;
    memberName?: string;
    memberDescription?: string;
    memberEmail?: string;
}): Promise<Proposal>;
export declare function getProposal(id: string): Promise<Proposal | null>;
export declare function getProposals(status?: string, type?: string, councilId?: string): Promise<Proposal[]>;
export declare function getPendingProposals(): Promise<Proposal[]>;
export declare function updateProposalStatus(id: string, status: ProposalStatus, safeTxHash?: string): Promise<Proposal | null>;
export declare function castVote(proposalId: string, voterAddress: string, choice: VoteChoice): Promise<Vote>;
export declare function getVote(proposalId: string, voterAddress: string): Promise<Vote | null>;
export declare function getVotesForProposal(proposalId: string): Promise<Vote[]>;
export declare function checkAndResolveProposal(proposalId: string, totalSigners: number): Promise<{
    resolved: boolean;
    status: ProposalStatus;
}>;
export declare function expireOldProposals(): Promise<number>;
export declare function hasPendingProposal(type: ProposalType, councilId?: string, memberAddress?: string): Promise<boolean>;
//# sourceMappingURL=proposals.d.ts.map