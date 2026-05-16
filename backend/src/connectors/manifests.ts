/**
 * Connector permission manifests (architecture plan §3).
 *
 * Each connector declares an explicit allow / requires-approval / blocked list.
 * The Policy Engine cross-checks proposed actions against these manifests
 * before any execution path can run.
 *
 * Adding a new connector does NOT require changes to the orchestrator or
 * Policy Engine — only a new entry here.
 */

import type { ActionType } from '../policy/engine.js';

export type ConnectorName =
  | 'wallet'
  | 'gmail'
  | 'calendar'
  | 'monad_campaigns'
  | 'social';

export interface ConnectorManifest {
  name:             ConnectorName;
  allowed:          string[];   // free-form op names (read_balance, draft_event, …)
  requiresApproval: string[];
  blocked:          string[];
}

export const CONNECTOR_MANIFESTS: Record<ConnectorName, ConnectorManifest> = {
  wallet: {
    name:             'wallet',
    allowed:          ['read_balance', 'read_history', 'prepare_transaction'],
    requiresApproval: ['sign_transaction', 'claim_reward', 'send_transfer'],
    blocked:          ['export_private_key', 'auto_transfer'],
  },
  gmail: {
    name:             'gmail',
    allowed:          ['read_metadata', 'read_selected_thread', 'create_draft'],
    requiresApproval: ['send_email', 'forward_email'],
    blocked:          ['delete_email', 'bulk_data_export'],
  },
  calendar: {
    name:             'calendar',
    allowed:          ['read_events', 'draft_event'],
    requiresApproval: ['create_event', 'invite_attendees'],
    blocked:          [],
  },
  monad_campaigns: {
    name:             'monad_campaigns',
    allowed:          ['read_campaign_list', 'read_campaign_detail'],
    requiresApproval: ['register', 'claim'],
    blocked:          [],
  },
  social: {
    name:             'social',
    allowed:          ['read_community_updates', 'draft_post'],
    requiresApproval: ['publish_post', 'send_dm'],
    blocked:          ['auto_post'],
  },
};

// Maps Policy Engine ActionType → (connector, op) so the engine can verify
// that a proposed action is actually permitted by the connector that would
// have to execute it. Returns null for action types that don't map to a
// connector (e.g. pure 'read_data').
export function lookupConnectorOp(
  type: ActionType
): { connector: ConnectorName; op: string } | null {
  switch (type) {
    case 'claim_reward':       return { connector: 'monad_campaigns', op: 'claim' };
    case 'send_transaction':   return { connector: 'wallet',          op: 'sign_transaction' };
    case 'send_email':         return { connector: 'gmail',           op: 'send_email' };
    case 'social_post':        return { connector: 'social',          op: 'publish_post' };
    case 'send_dm':            return { connector: 'social',          op: 'send_dm' };
    case 'token_approval':     return { connector: 'wallet',          op: 'sign_transaction' };
    case 'delete_email':       return { connector: 'gmail',           op: 'delete_email' };
    case 'bulk_data_export':   return { connector: 'gmail',           op: 'bulk_data_export' };
    case 'export_private_key': return { connector: 'wallet',          op: 'export_private_key' };
    case 'auto_transfer':      return { connector: 'wallet',          op: 'auto_transfer' };
    case 'auto_post':          return { connector: 'social',          op: 'auto_post' };
    default:                   return null;
  }
}

export function isConnectorBlocked(
  connector: ConnectorName,
  op: string
): boolean {
  return CONNECTOR_MANIFESTS[connector].blocked.includes(op);
}

export function connectorRequiresApproval(
  connector: ConnectorName,
  op: string
): boolean {
  return CONNECTOR_MANIFESTS[connector].requiresApproval.includes(op);
}
