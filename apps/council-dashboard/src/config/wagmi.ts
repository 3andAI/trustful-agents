import { http, createConfig } from 'wagmi';
import { base, baseSepolia, type Chain } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { CHAIN_ID } from './contracts';

// Re-export everything from contracts for backward compatibility
export * from './contracts';

// Select chain based on centralized config
const chain: Chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [
    injected(),
  ],
  transports: {
    [chain.id]: http(),
  },
});
