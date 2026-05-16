/**
 * OpportunityAgent
 *
 * Scores and ranks claimable campaigns against the user's local profile.
 * Returns an ordered list with the best opportunity first.
 */

import type { ClaimableReward } from './walletAgent.js';
import { evaluatePolicy, type AgentAction } from '../policy/engine.js';

export interface UserProfile {
  interests:        string[];      // e.g. ['defi', 'tooling', 'ai', 'gaming']
  riskTolerance:    'low' | 'medium' | 'high';
  minRewardMON:     number;
  maxMinutes:       number;
}

export interface ScoredOpportunity {
  campaign:         ClaimableReward;
  score:            number;        // 0–100
  recommended:      boolean;
  policyResult:     ReturnType<typeof evaluatePolicy>;
  explanation:      string;        // shown in Approval Card and voice response
}

export function runOpportunityAgent(
  campaigns: ClaimableReward[],
  profile: UserProfile,
  walletAddress: string,
  contractAddress?: string
): ScoredOpportunity[] {
  const scored = campaigns.map(c => score(c, profile, walletAddress, contractAddress));

  // Sort by score descending; blocked ones go to the bottom
  return scored.sort((a, b) => {
    if (a.policyResult.blocked && !b.policyResult.blocked) return 1;
    if (!a.policyResult.blocked && b.policyResult.blocked) return -1;
    return b.score - a.score;
  });
}

function score(
  c: ClaimableReward,
  profile: UserProfile,
  walletAddress: string,
  contractAddress?: string
): ScoredOpportunity {
  // ── Build action for policy check ─────────────────────────────
  const action: AgentAction = {
    type:                'claim_reward',
    source:              'user_command',
    campaignId:          c.campaignId,
    contractAddress,
    isNewDeploy:         false,
    isUnlimitedApproval: c.name.toLowerCase().includes('demo (blocked)'), // demo flag
    rewardAmount:        parseFloat(c.rewardMON),
    estimatedMinutes:    c.estimatedMinutes,
    dataShared:          ['wallet address'],
    cloudUsed:           false,
    description:         `Claim ${c.rewardMON} MON from "${c.name}"`,
  };

  const policyResult = evaluatePolicy(action);

  // ── Scoring formula (0–100) ────────────────────────────────────
  let s = 50; // base

  // Reward/time ratio (higher = better)
  const ratio = parseFloat(c.rewardMON) / Math.max(c.estimatedMinutes, 1);
  s += Math.min(ratio * 10, 25);

  // Risk penalty
  if (c.riskLevel === 'medium') s -= 10;
  if (c.riskLevel === 'high')   s -= 25;

  // Below user's min reward threshold
  if (parseFloat(c.rewardMON) < profile.minRewardMON) s -= 20;

  // Exceeds user's time budget
  if (c.estimatedMinutes > profile.maxMinutes) s -= 15;

  // Risk tolerance gate
  if (profile.riskTolerance === 'low' && c.riskLevel !== 'low')    s -= 20;
  if (profile.riskTolerance === 'medium' && c.riskLevel === 'high') s -= 10;

  // Deadline urgency bonus (< 24h remaining = +10)
  const hoursLeft = (c.deadline.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 24) s += 10;

  // Policy block = score to 0
  if (policyResult.blocked) s = 0;

  s = Math.max(0, Math.min(100, Math.round(s)));

  const explanation = buildExplanation(c, policyResult, ratio, hoursLeft, profile);

  return {
    campaign:    c,
    score:       s,
    recommended: s >= 60 && !policyResult.blocked,
    policyResult,
    explanation,
  };
}

function buildExplanation(
  c: ClaimableReward,
  policy: ReturnType<typeof evaluatePolicy>,
  ratio: number,
  hoursLeft: number,
  profile: UserProfile
): string {
  if (policy.blocked) {
    return policy.blockReason ?? 'This action has been blocked by the Policy Engine.';
  }

  const parts: string[] = [];
  parts.push(`${c.rewardMON} MON reward for roughly ${c.estimatedMinutes} minute${c.estimatedMinutes > 1 ? 's' : ''} of work.`);
  if (hoursLeft < 24) parts.push(`Deadline in ${Math.round(hoursLeft)} hours — act soon.`);
  if (policy.warnings.length) parts.push(policy.warnings[0]);
  parts.push(`Risk level: ${c.riskLevel}.`);

  return parts.join(' ');
}
