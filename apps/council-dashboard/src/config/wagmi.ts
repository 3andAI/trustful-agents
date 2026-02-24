import { http, createConfig } from 'wagmi';
import { base, baseSepolia, sepolia, type Chain } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { CHAIN_ID } from './contracts';

// Re-export everything from contracts for backward compatibility
export * from './contracts';

// Select chain based on centralized config
const chain: Chain = CHAIN_ID === 8453 ? base : CHAIN_ID === 11155111 ? sepolia : baseSepolia;

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [
    injected(),
  ],
  transports: {
    [chain.id]: http(),
  },
});
