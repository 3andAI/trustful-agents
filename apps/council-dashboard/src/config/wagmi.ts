import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});

// Contract addresses on Base Sepolia
export const contracts = {
  chainId: 84532,
  usdc: '0xd6897C4801c639Ff4eAaA31D7A5b4802613DB681' as const,
  erc8004Registry: '0x454909C7551158e12a6a5192dEB359dDF067ec80' as const,
  collateralVault: '0xC948389425061c2C960c034c1c9526E9E6f39ff9' as const,
  termsRegistry: '0xBDc5328D4442A1e893CD2b1F75d3F64a3e50f923' as const,
  councilRegistry: '0xAaA608c80168D90d77Ec5a7f72Fb939E7Add5C32' as const,
  trustfulValidator: '0x9628C1bD875C3378B14f0108b60B0b5739fE92E8' as const,
  claimsManager: (import.meta.env.VITE_CLAIMS_MANAGER_ADDRESS || '0x7B0465DF41c3649f88A627cF06941469BE9C7a44') as `0x${string}`,
  rulingExecutor: (import.meta.env.VITE_RULING_EXECUTOR_ADDRESS || '0x2a49b1826810AefAfFf93eC9317A426BbF8DC11f') as `0x${string}`,
};
