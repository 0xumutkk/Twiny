/**
 * PolicyEngine — deterministic, non-LLM rule layer.
 *
 * Architecture plan rule: "LLM suggests. Policy Engine decides what is allowed."
 * This file never calls any AI API. All rules are explicit if/else logic.
 */

import { lookupConnectorOp, isConnectorBlocked } from '../connectors/manifests.js';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export type ActionType =
  | 'claim_reward'
  | 'send_transaction'
  | 'send_email'
  | 'social_post'
  | 'send_dm'
  | 'token_approval'
  | 'read_data'
  | 'prepare_draft'
  // Always-blocked types (architecture plan §3) — listed here so callers
  // get a type-checked block instead of a silent pass.
  | 'export_private_key'
  | 'bulk_data_export'
  | 'auto_transfer'
  | 'delete_email'
  | 'auto_post';

// Hardcoded "always blocked" set — cannot be overridden by LLM output or
// connector config (architecture plan §3).
const ALWAYS_BLOCKED: ReadonlySet<ActionType> = new Set<ActionType>([
  'export_private_key',
  'bulk_data_export',
  'auto_transfer',
  'delete_email',
  'auto_post',
]);

export type SourceType = 'user_command' | 'email_content' | 'web_content' | 'campaign_data';

export interface AgentAction {
  type: ActionType;
  source: SourceType;
  campaignId?: number;
  contractAddress?: string;
  isNewDeploy?: boolean;
  isUnlimitedApproval?: boolean;
  rewardAmount?: number;   // in MON
  estimatedMinutes?: number;
  dataShared?: string[];
  cloudUsed?: boolean;
  description: string;
}

export interface PolicyResult {
  requiresApproval: boolean;
  blocked: boolean;
  blockReason?: string;
  riskLevel: RiskLevel;
  warnings: string[];
}

export function evaluatePolicy(action: AgentAction): PolicyResult {
  const warnings: string[] = [];

  // ── RULE 0a: Connector manifest cross-check ───────────────────
  const op = lookupConnectorOp(action.type);
  if (op && isConnectorBlocked(op.connector, op.op)) {
    return {
      requiresApproval: true,
      blocked: true,
      blockReason:
        `Connector "${op.connector}" does not permit operation "${op.op}". ` +
        `This is enforced by the connector manifest and cannot be overridden.`,
      riskLevel: 'blocked',
      warnings: [],
    };
  }

  // ── RULE 0b: Hardcoded always-blocked action types ────────────
  if (ALWAYS_BLOCKED.has(action.type)) {
    return {
      requiresApproval: true,
      blocked: true,
      blockReason:
        `Action type "${action.type}" is permanently blocked by Twiny's policy. ` +
        `Private keys, bulk exports, auto-transfers, mail deletions and ` +
        `automated public posts are never executable.`,
      riskLevel: 'blocked',
      warnings: [],
    };
  }

  // ── RULE 1: External content is always untrusted ──────────────
  if (action.source === 'email_content' || action.source === 'web_content') {
    return {
      requiresApproval: true,
      blocked: true,
      blockReason:
        'This action originated from external content (email or web page). ' +
        'Twiny never executes instructions from untrusted sources. ' +
        'Please issue the command directly.',
      riskLevel: 'blocked',
      warnings: [],
    };
  }

  // ── RULE 2: Unlimited token approval is always blocked ────────
  if (action.isUnlimitedApproval) {
    return {
      requiresApproval: true,
      blocked: true,
      blockReason:
        'This contract requests unlimited token approval. ' +
        'Twiny blocks unlimited approvals by default — they give the contract ' +
        'full control over your tokens indefinitely.',
      riskLevel: 'blocked',
      warnings: [],
    };
  }

  // ── RULE 3: New deploy contracts raise risk ────────────────────
  if (action.isNewDeploy) {
    warnings.push(
      'Contract was recently deployed. There is less time to audit it for vulnerabilities.'
    );
  }

  // ── RULE 4: Money-moving actions always require approval ──────
  const moneyActions: ActionType[] = [
    'claim_reward',
    'send_transaction',
    'token_approval',
  ];
  if (moneyActions.includes(action.type)) {
    const risk = deriveRisk(action, warnings);
    return {
      requiresApproval: true,
      blocked: false,
      riskLevel: risk,
      warnings,
    };
  }

  // ── RULE 5: Communication actions always require approval ─────
  const commsActions: ActionType[] = ['send_email', 'social_post', 'send_dm'];
  if (commsActions.includes(action.type)) {
    return {
      requiresApproval: true,
      blocked: false,
      riskLevel: 'low',
      warnings,
    };
  }

  // ── RULE 6: Read/prepare actions — no approval needed ─────────
  return {
    requiresApproval: false,
    blocked: false,
    riskLevel: 'low',
    warnings,
  };
}

function deriveRisk(action: AgentAction, warnings: string[]): RiskLevel {
  // New deploy + money = high
  if (action.isNewDeploy) return 'high';

  // Unverified contract address (no address at all = unknown)
  if (action.type === 'send_transaction' && !action.contractAddress) {
    warnings.push('No contract address provided — cannot verify destination.');
    return 'high';
  }

  // Large reward or large transfer = medium caution
  if (action.rewardAmount && action.rewardAmount > 10) {
    warnings.push('Reward amount is unusually large. Verify the campaign is legitimate.');
    return 'medium';
  }

  return 'low';
}
