/**
 * WalletAgent
 *
 * Reads wallet data and prepares transaction previews.
 * NEVER signs or broadcasts — that is always the user's action via Privy.
 */

import { encodeFunctionData, formatEther, isAddress, parseEther, type Address } from 'viem';
import { evaluatePolicy, type AgentAction, type SourceType } from '../policy/engine.js';
import { getMonadClient } from './chain.js';
import { assessClaimRisk, type RiskAssessment } from './riskAgent.js';

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

export interface WalletAgentResult {
  balance: string;
  claimableRewards: ClaimableReward[];
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
  calldata: string;
  rewardMON: string;
  policyResult: ReturnType<typeof evaluatePolicy>;
  riskAssessment?: RiskAssessment;
}

export interface PreparedTransfer {
  kind: 'native_transfer';
  network: 'Monad testnet';
  recipient: string;
  valueMON: string;
  valueWei: string;
  txTo: string;
  txValue: string;
  txData: '0x';
  policyResult: ReturnType<typeof evaluatePolicy>;
  warnings: string[];
}

// ── Step 1: Read-only wallet snapshot ────────────────────────────
export async function runWalletAgent(walletAddress: string): Promise<WalletAgentResult> {
  const client          = getMonadClient();
  const contractAddress = process.env.CAMPAIGN_CONTRACT_ADDRESS as Address | undefined;

  const balanceWei = await client.getBalance({ address: walletAddress as Address });
  const balance    = formatEther(balanceWei);

  if (!contractAddress) {
    return { balance, claimableRewards: getMockCampaigns() };
  }

  const rawCampaigns = await client.readContract({
    address: contractAddress,
    abi: campaignAbi,
    functionName: 'getCampaigns',
  }) as any[];

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
        campaignId:       Number(c.id),
        name:             c.name,
        description:      c.description,
        rewardMON:        formatEther(c.rewardPerUser),
        riskLevel:        c.riskLevel,
        estimatedMinutes: Number(c.estimatedMinutes),
        deadline:         new Date(Number(c.deadline) * 1000),
      });
    }
  }

  return { balance, claimableRewards: claimable };
}

// ── Step 2: Explicit, user-selected prepare ──────────────────────
// Decoupled from the read step so the LLM cannot silently prepare an
// arbitrary campaign — the frontend must POST the chosen campaignId after
// the user picks it from the opportunity list.
export async function prepareClaim(params: {
  walletAddress: string;
  campaignId:    number;
  source:        SourceType;
}): Promise<PreparedClaim | { error: string }> {
  const { walletAddress, campaignId, source } = params;
  const contractAddress = process.env.CAMPAIGN_CONTRACT_ADDRESS as Address | undefined;
  if (!contractAddress) {
    return { error: 'CAMPAIGN_CONTRACT_ADDRESS not configured' };
  }

  const snapshot = await runWalletAgent(walletAddress);
  const target   = snapshot.claimableRewards.find(c => c.campaignId === campaignId);
  if (!target) {
    return { error: `Campaign ${campaignId} is not claimable for this wallet` };
  }

  const action: AgentAction = {
    type:                'claim_reward',
    source,
    campaignId:          target.campaignId,
    contractAddress,
    isNewDeploy:         false,
    isUnlimitedApproval: false,
    rewardAmount:        parseFloat(target.rewardMON),
    estimatedMinutes:    target.estimatedMinutes,
    dataShared:          ['wallet address'],
    cloudUsed:           false,
    description:         `Claim ${target.rewardMON} MON reward from "${target.name}"`,
  };

  const policyResult    = evaluatePolicy(action);
  const riskAssessment  = policyResult.blocked
    ? undefined
    : await assessClaimRisk(walletAddress, contractAddress, target.campaignId);

  return {
    campaignId:      target.campaignId,
    contractAddress,
    calldata:        encodeClaim(target.campaignId),
    rewardMON:       target.rewardMON,
    policyResult,
    riskAssessment,
  };
}

export async function prepareTransfer(params: {
  walletAddress: string;
  recipient:     string;
  amountMON:     string | number;
  network:       string;
  source:        SourceType;
}): Promise<PreparedTransfer | { error: string }> {
  const { walletAddress, recipient, amountMON, network, source } = params;

  if (source !== 'user_command') {
    return { error: 'Transfers can only be prepared from a direct user command.' };
  }

  if (!isMonadNetwork(network)) {
    return { error: 'Only Monad testnet native MON transfers are supported in this demo.' };
  }

  if (!isAddress(walletAddress) || !isAddress(recipient)) {
    return { error: 'A valid 0x wallet address is required for both sender and recipient.' };
  }

  const normalizedAmount = String(amountMON).replace(',', '.').trim();
  if (!/^\d+(\.\d+)?$/.test(normalizedAmount) || Number(normalizedAmount) <= 0) {
    return { error: 'amountMON must be a positive MON amount.' };
  }

  let valueWei: bigint;
  try {
    valueWei = parseEther(normalizedAmount);
  } catch {
    return { error: 'amountMON is not a valid MON amount.' };
  }

  const client = getMonadClient();
  const balanceWei = await client.getBalance({ address: walletAddress as Address });
  const warnings: string[] = [];

  if (balanceWei < valueWei) {
    return {
      error: `Insufficient balance. Wallet has ${Number(formatEther(balanceWei)).toFixed(4)} MON.`,
    };
  }

  const action: AgentAction = {
    type: 'send_transaction',
    source,
    contractAddress: recipient,
    isNewDeploy: false,
    isUnlimitedApproval: false,
    rewardAmount: Number(normalizedAmount),
    dataShared: ['wallet address', 'recipient address', 'transfer amount'],
    cloudUsed: false,
    description: `Send ${normalizedAmount} MON to ${recipient} on Monad testnet`,
  };

  const policyResult = evaluatePolicy(action);

  try {
    const gas = await client.estimateGas({
      account: walletAddress as Address,
      to: recipient as Address,
      value: valueWei,
    });
    const gasPrice = await client.getGasPrice();
    const estimatedFee = Number(formatEther(gas * gasPrice)).toFixed(6);
    warnings.push(`Estimated network fee: ${estimatedFee} MON.`);
  } catch (err: any) {
    warnings.push(`Gas estimation unavailable: ${String(err?.shortMessage ?? err?.message ?? err)}`);
  }

  return {
    kind: 'native_transfer',
    network: 'Monad testnet',
    recipient,
    valueMON: normalizedAmount,
    valueWei: valueWei.toString(),
    txTo: recipient,
    txValue: `0x${valueWei.toString(16)}`,
    txData: '0x',
    policyResult,
    warnings: [...policyResult.warnings, ...warnings],
  };
}

function encodeClaim(campaignId: number): string {
  return encodeFunctionData({
    abi: campaignAbi,
    functionName: 'claimReward',
    args: [BigInt(campaignId)],
  });
}

function isMonadNetwork(network: string): boolean {
  const value = network.trim().toLowerCase();
  return value === 'monad' || value === 'monad testnet' || value === 'monad-testnet';
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
