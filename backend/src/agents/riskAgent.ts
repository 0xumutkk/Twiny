/**
 * RiskAgent
 *
 * Architecture plan §2.3: analyze contract, estimate fee, simulate transaction.
 * Never advises investment, never auto-trades. Pure read-only chain analysis.
 *
 * Simulation uses viem `simulateContract` (an eth_call under the hood) — no
 * gas spent, no on-chain state change. If the contract would revert, we
 * surface the reason so the Approval Card can warn the user before signing.
 */

import { type Address } from 'viem';
import { getMonadClient } from './chain.js';

const campaignClaimAbi = [
  {
    name: 'claimReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'campaignId', type: 'uint256' }],
    outputs: [],
  },
] as const;

export interface RiskAssessment {
  simulationOk:     boolean;
  revertReason?:    string;
  estimatedGas?:    string;        // decimal string
  estimatedFeeMON?: string;        // formatted
  warnings:        string[];
}

export async function assessClaimRisk(
  walletAddress: string,
  contractAddress: string,
  campaignId: number
): Promise<RiskAssessment> {
  const client = getMonadClient();
  const warnings: string[] = [];

  // ── Simulate the claim call ────────────────────────────────────
  try {
    await client.simulateContract({
      address: contractAddress as Address,
      abi: campaignClaimAbi,
      functionName: 'claimReward',
      args: [BigInt(campaignId)],
      account: walletAddress as Address,
    });
  } catch (err: any) {
    const reason = extractRevertReason(err);
    return {
      simulationOk: false,
      revertReason: reason,
      warnings: [`Simulation reverted: ${reason}. The transaction would fail on-chain.`],
    };
  }

  // ── Estimate gas + fee ─────────────────────────────────────────
  try {
    const gas = await client.estimateContractGas({
      address: contractAddress as Address,
      abi: campaignClaimAbi,
      functionName: 'claimReward',
      args: [BigInt(campaignId)],
      account: walletAddress as Address,
    });

    const gasPrice = await client.getGasPrice();
    const feeWei   = gas * gasPrice;
    const feeMON   = (Number(feeWei) / 1e18).toFixed(6);

    return {
      simulationOk:    true,
      estimatedGas:    gas.toString(),
      estimatedFeeMON: feeMON,
      warnings,
    };
  } catch (err: any) {
    warnings.push(`Gas estimation failed: ${String(err?.shortMessage ?? err?.message ?? err)}`);
    return { simulationOk: true, warnings };
  }
}

function extractRevertReason(err: any): string {
  return (
    err?.shortMessage ??
    err?.cause?.shortMessage ??
    err?.message ??
    'unknown revert'
  );
}
