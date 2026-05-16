/**
 * WalletAgent
 *
 * Reads wallet data and prepares transaction previews.
 * NEVER signs or broadcasts — that is always the user's action via Privy.
 */

import { createPublicClient, encodeFunctionData, http, formatEther, type Address } from 'viem';
import { evaluatePolicy, type AgentAction } from '../policy/engine.js';

// Monad testnet chain definition for viem
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MONAD_TESTNET_RPC ?? 'https://testnet-rpc.monad.xyz'] },
  },
} as const;

// Minimal ABI — only functions Wallet Agent needs
const campaignAbi = [
  {
    name: 'getCampaigns',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id',               type: 'uint256' },
          { name: 'name',             type: 'string'  },
          { name: 'description',      type: 'string'  },
          { name: 'rewardPerUser',    type: 'uint256' },
          { name: 'maxClaims',        type: 'uint256' },
          { name: 'claimCount',       type: 'uint256' },
          { name: 'deadline',         type: 'uint256' },
          { name: 'owner',            type: 'address' },
          { name: 'active',           type: 'bool'    },
          { name: 'riskLevel',        type: 'string'  },
          { name: 'estimatedMinutes', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'canClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'campaignId', type: 'uint256' },
      { name: 'user',       type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'claimReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'campaignId', type: 'uint256' }],
    outputs: [],
  },
] as const;

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export interface WalletAgentResult {
  balance: string;           // formatted MON
  claimableRewards: ClaimableReward[];
  preparedAction?: PreparedClaim;
}

export interface ClaimableReward {
  campaignId: number;
  name: string;
  description: string;
  rewardMON: string;
  riskLevel: string;
  estimatedMinutes: number;
  deadline: Date;
}

export interface PreparedClaim {
  campaignId: number;
  contractAddress: string;
  calldata: string;          // hex encoded for Privy useSendTransaction
  rewardMON: string;
  policyResult: ReturnType<typeof evaluatePolicy>;
}

export async function runWalletAgent(
  walletAddress: string,
  selectedCampaignId?: number
): Promise<WalletAgentResult> {
  const contractAddress = process.env.CAMPAIGN_CONTRACT_ADDRESS as Address | undefined;

  // ── Read balance ──────────────────────────────────────────────
  const balanceWei = await client.getBalance({ address: walletAddress as Address });
  const balance = formatEther(balanceWei);

  if (!contractAddress) {
    // No contract yet — return mock data for early development
    return {
      balance,
      claimableRewards: getMockCampaigns(),
    };
  }

  // ── Read campaigns from contract ──────────────────────────────
  const rawCampaigns = await client.readContract({
    address: contractAddress,
    abi: campaignAbi,
    functionName: 'getCampaigns',
  }) as any[];

  // ── Check which ones the user can still claim ─────────────────
  const claimable: ClaimableReward[] = [];
  for (const c of rawCampaigns) {
    const eligible = await client.readContract({
      address: contractAddress,
      abi: campaignAbi,
      functionName: 'canClaim',
      args: [c.id, walletAddress as Address],
    });
    if (eligible) {
      claimable.push({
        campaignId: Number(c.id),
        name:             c.name,
        description:      c.description,
        rewardMON:        formatEther(c.rewardPerUser),
        riskLevel:        c.riskLevel,
        estimatedMinutes: Number(c.estimatedMinutes),
        deadline:         new Date(Number(c.deadline) * 1000),
      });
    }
  }

  // ── Prepare transaction for the selected campaign ─────────────
  let preparedAction: PreparedClaim | undefined;
  if (selectedCampaignId) {
    const target = claimable.find(c => c.campaignId === selectedCampaignId);
    if (target) {
      // Build action for Policy Engine evaluation
      const action: AgentAction = {
        type:             'claim_reward',
        source:           'user_command',
        campaignId:       target.campaignId,
        contractAddress,
        isNewDeploy:      false,
        isUnlimitedApproval: false,
        rewardAmount:     parseFloat(target.rewardMON),
        estimatedMinutes: target.estimatedMinutes,
        dataShared:       ['wallet address'],
        cloudUsed:        false,
        description:      `Claim ${target.rewardMON} MON reward from "${target.name}"`,
      };

      const policyResult = evaluatePolicy(action);

      preparedAction = {
        campaignId:      target.campaignId,
        contractAddress,
        calldata: encodeClaim(target.campaignId),
        rewardMON:       target.rewardMON,
        policyResult,
      };
    }
  }

  return { balance, claimableRewards: claimable, preparedAction };
}

// Encode claimReward(campaignId) — matches TwinyCampaign.sol
function encodeClaim(campaignId: number): string {
  return encodeFunctionData({
    abi: campaignAbi,
    functionName: 'claimReward',
    args: [BigInt(campaignId)],
  });
}

function getMockCampaigns(): ClaimableReward[] {
  return [
    {
      campaignId:       1,
      name:             'Monad Wallet Beta',
      description:      'Test the Monad wallet integration and submit feedback.',
      rewardMON:        '1.2',
      riskLevel:        'low',
      estimatedMinutes: 2,
      deadline:         new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      campaignId:       2,
      name:             'Monad Testnet Feedback',
      description:      'Submit a bug report or feedback on the Monad testnet.',
      rewardMON:        '0.8',
      riskLevel:        'low',
      estimatedMinutes: 5,
      deadline:         new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      campaignId:       3,
      name:             'High Risk Demo (blocked)',
      description:      'Demo campaign with unlimited approval — Policy Engine will block this.',
      rewardMON:        '5.0',
      riskLevel:        'high',
      estimatedMinutes: 1,
      deadline:         new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
  ];
}
