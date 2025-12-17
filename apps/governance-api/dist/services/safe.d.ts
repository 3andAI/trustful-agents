import { type Address } from 'viem';
import type { SafeInfo, SafeTransactionResponse } from '../types/index.js';
export declare function getSafeInfo(): Promise<SafeInfo>;
export declare function getSafeOwners(): Promise<string[]>;
export declare function isSafeOwner(address: string): Promise<boolean>;
export declare function getPendingTransactions(): Promise<SafeTransactionResponse[]>;
export declare function getTransaction(safeTxHash: string): Promise<SafeTransactionResponse | null>;
export interface ProposeTransactionParams {
    to: Address;
    data: `0x${string}`;
    value?: string;
    signerPrivateKey?: `0x${string}`;
    signerAddress: Address;
}
export declare function proposeTransaction(params: ProposeTransactionParams): Promise<string>;
export declare function signTransaction(safeTxHash: string, signerPrivateKey: `0x${string}`, signerAddress: Address): Promise<void>;
export declare function encodeCreateCouncil(name: string, description: string, vertical: string, quorumPercentage: number, claimDepositPercentage: number, votingPeriod: number, evidencePeriod: number): `0x${string}`;
export declare function encodeAddMember(councilId: `0x${string}`, member: Address): `0x${string}`;
export declare function encodeRemoveMember(councilId: `0x${string}`, member: Address): `0x${string}`;
export declare function encodeReassignAgent(agentId: bigint, newCouncilId: `0x${string}`): `0x${string}`;
export declare function healthCheck(): Promise<boolean>;
//# sourceMappingURL=safe.d.ts.map