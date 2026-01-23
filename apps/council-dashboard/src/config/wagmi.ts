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
  usdc: '0x63d5a529eD8a8192E2201c0cea4469397efE30Ba' as const,
  erc8004Registry: '0xb3B4b5042Fd3600404846671Ff5558719860b694' as const,
  collateralVault: '0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4' as const,
  termsRegistry: '0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d' as const,
  councilRegistry: '0x54996FAE14f35C32EfA2F0f92237e9B924a93F66' as const,
  trustfulValidator: '0xe75817D8aADA91968AD492d583602Ec10B2569a6' as const,
  claimsManager: (import.meta.env.VITE_CLAIMS_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  rulingExecutor: (import.meta.env.VITE_RULING_EXECUTOR_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
};
