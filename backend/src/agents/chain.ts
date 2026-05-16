/**
 * Shared viem client for the Monad chain.
 *
 * All chain config flows from env so we don't duplicate the chain id /
 * RPC URL across agents.
 */

import { createPublicClient, http, type PublicClient } from 'viem';

const chainId = Number(process.env.MONAD_CHAIN_ID ?? 10143);
const rpcUrl  = process.env.MONAD_TESTNET_RPC ?? 'https://testnet-rpc.monad.xyz';

export const monadChain = {
  id: chainId,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;

let cached: PublicClient | null = null;

export function getMonadClient(): PublicClient {
  if (!cached) {
    cached = createPublicClient({ chain: monadChain, transport: http() }) as PublicClient;
  }
  return cached;
}
