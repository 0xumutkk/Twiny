/**
 * Agent registry
 *
 * Single source of truth for subagent metadata. Both the orchestrator and the
 * frontend Permission Dashboard read from here so agent identity, connector
 * binding and operational status stay consistent.
 *
 * Architecture plan §2.3 mandates a common AgentResult shape — that shape
 * lives in this file (`AgentActivity`) and every subagent's orchestrator
 * adapter emits one entry per run.
 */

import type { ConnectorName } from '../connectors/manifests.js';
import { CONNECTOR_MANIFESTS } from '../connectors/manifests.js';

export type AgentName =
  | 'wallet'
  | 'opportunity'
  | 'risk'
  | 'mail'
  | 'calendar'
  | 'social'
  | 'policy';

export type AgentStatus = 'connected' | 'mock_data' | 'not_connected' | 'always_on';

export interface AgentDescriptor {
  name:              AgentName;
  displayName:       string;
  role:              string;
  connector?:        ConnectorName;
  inScope:           boolean;
  evaluateStatus:    () => AgentStatus;
}

// Activity entry emitted by every subagent invocation, returned to the
// frontend so the user sees which agents ran and what they produced.
export interface AgentActivity {
  agent:        AgentName;
  displayName:  string;
  summary:      string;          // one-line plain-language summary
  detail?:      unknown;         // optional structured payload
  status:       'ok' | 'noop' | 'blocked' | 'error';
  durationMs?:  number;
}

export const AGENT_REGISTRY: AgentDescriptor[] = [
  {
    name:        'wallet',
    displayName: 'Wallet Agent',
    role:        'Reads balance, history and prepares transactions. Never signs.',
    connector:   'wallet',
    inScope:     true,
    evaluateStatus: () => process.env.CAMPAIGN_CONTRACT_ADDRESS ? 'connected' : 'mock_data',
  },
  {
    name:        'opportunity',
    displayName: 'Opportunity Agent',
    role:        'Scores and ranks claimable campaigns against the user profile.',
    connector:   'monad_campaigns',
    inScope:     true,
    evaluateStatus: () => process.env.CAMPAIGN_CONTRACT_ADDRESS ? 'connected' : 'mock_data',
  },
  {
    name:        'risk',
    displayName: 'Risk Agent',
    role:        'Simulates contract calls and estimates gas. Never trades.',
    connector:   'wallet',
    inScope:     true,
    evaluateStatus: () => process.env.CAMPAIGN_CONTRACT_ADDRESS ? 'connected' : 'mock_data',
  },
  {
    name:        'mail',
    displayName: 'Mail Agent',
    role:        'Reads today\'s Gmail metadata and summarises locally.',
    connector:   'gmail',
    inScope:     true,
    evaluateStatus: () => {
      const hasCreds = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      const hasToken = Boolean(process.env.GMAIL_REFRESH_TOKEN || process.env.GMAIL_ACCESS_TOKEN);
      if (hasCreds && hasToken) return 'connected';
      return 'not_connected';
    },
  },
  {
    name:        'calendar',
    displayName: 'Calendar Agent',
    role:        'Phase 2 — reads events and drafts entries with approval.',
    connector:   'calendar',
    inScope:     false,
    evaluateStatus: () => 'not_connected',
  },
  {
    name:        'social',
    displayName: 'Social Agent',
    role:        'Phase 3 — drafts posts and tracks community activity.',
    connector:   'social',
    inScope:     false,
    evaluateStatus: () => 'not_connected',
  },
  {
    name:        'policy',
    displayName: 'Policy Engine',
    role:        'Deterministic rule layer that gates every action before approval.',
    inScope:     true,
    evaluateStatus: () => 'always_on',
  },
];

export interface AgentStatusReport {
  name:             AgentName;
  displayName:      string;
  role:             string;
  status:           AgentStatus;
  inScope:          boolean;
  connector?:       ConnectorName;
  allowed?:         string[];
  requiresApproval?: string[];
  blocked?:         string[];
}

export function getAgentStatusReport(): AgentStatusReport[] {
  return AGENT_REGISTRY.map(agent => {
    const manifest = agent.connector ? CONNECTOR_MANIFESTS[agent.connector] : undefined;
    return {
      name:             agent.name,
      displayName:      agent.displayName,
      role:             agent.role,
      status:           agent.evaluateStatus(),
      inScope:          agent.inScope,
      connector:        agent.connector,
      allowed:          manifest?.allowed,
      requiresApproval: manifest?.requiresApproval,
      blocked:          manifest?.blocked,
    };
  });
}

export function describeAgent(name: AgentName): AgentDescriptor | undefined {
  return AGENT_REGISTRY.find(a => a.name === name);
}

// Helper: build an AgentActivity entry consistently.
export function activity(
  agent: AgentName,
  summary: string,
  opts: { status?: AgentActivity['status']; detail?: unknown; durationMs?: number } = {}
): AgentActivity {
  const desc = describeAgent(agent);
  return {
    agent,
    displayName: desc?.displayName ?? agent,
    summary,
    status: opts.status ?? 'ok',
    detail: opts.detail,
    durationMs: opts.durationMs,
  };
}
