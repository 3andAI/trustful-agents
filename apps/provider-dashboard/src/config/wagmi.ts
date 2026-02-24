import { http, createConfig } from 'wagmi'
import { base, baseSepolia, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { CHAIN_ID } from './contracts'

// Select chain based on centralized config
const chain = CHAIN_ID === 8453 ? base : CHAIN_ID === 11155111 ? sepolia : baseSepolia;

export const config = createConfig({
  chains: [chain],
  connectors: [
    injected(),
  ],
  transports: {
    [chain.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
