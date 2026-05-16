'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AgentStatus {
  name:             string;
  displayName:      string;
  role:             string;
  status:           'connected' | 'mock_data' | 'not_connected' | 'always_on';
  inScope:          boolean;
  connector?:       string;
  allowed?:         string[];
  requiresApproval?: string[];
  blocked?:         string[];
}

interface AgentsStatusResponse {
  contractAddress: string | null;
  chainId:         number;
  agents:          AgentStatus[];
}

const STATUS_STYLE: Record<AgentStatus['status'], { bg: string; color: string; label: string }> = {
  connected:     { bg: '#DFF6ED', color: '#007A5E', label: 'Connected' },
  mock_data:     { bg: '#FDECC8', color: '#8A5A12', label: 'Mock data' },
  not_connected: { bg: '#F0EDE6', color: '#6B6F66', label: 'Not connected' },
  always_on:     { bg: '#EEF5FF', color: '#264C7A', label: 'Always on' },
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export default function PermissionsPage() {
  const [data, setData]   = useState<AgentsStatusResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${backendUrl}/api/agents/status`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setError(String(e)));
  }, []);

  return (
    <main style={page}>
      <header style={top}>
        <Link href="/" style={backLink}>← Back</Link>
        <div>
          <div style={kicker}>Permission Dashboard</div>
          <h1 style={title}>Subagent control surface</h1>
        </div>
      </header>

      <section style={metaBar}>
        <div><strong>Chain:</strong> Monad Testnet ({data?.chainId ?? '…'})</div>
        <div style={{ wordBreak: 'break-all' }}>
          <strong>Contract:</strong>{' '}
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{data?.contractAddress ?? 'not deployed'}</span>
        </div>
      </section>

      {error && <div style={errorBox}>Failed to load agent status: {error}</div>}

      <section style={list}>
        {data?.agents.map(agent => (
          <article key={agent.name} style={card}>
            <div style={cardHead}>
              <div>
                <div style={agentTitle}>{agent.displayName}</div>
                <div style={agentRole}>{agent.role}</div>
              </div>
              <div style={{ ...statusPill, background: STATUS_STYLE[agent.status].bg, color: STATUS_STYLE[agent.status].color }}>
                {STATUS_STYLE[agent.status].label}
              </div>
            </div>

            {!agent.inScope && (
              <div style={scopeNote}>
                Out of MVP scope (Phase 2/3 in the architecture plan).
              </div>
            )}

            {agent.connector && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PermissionGroup label="Allowed"          items={agent.allowed}          tone="#007A5E" />
                <PermissionGroup label="Requires approval" items={agent.requiresApproval} tone="#8A5A12" />
                <PermissionGroup label="Blocked"          items={agent.blocked}          tone="#A33A3A" />
              </div>
            )}
          </article>
        ))}
      </section>

      <footer style={footer}>
        Read/analyze/prepare can be delegated. Execute must be approved.
      </footer>
    </main>
  );
}

function PermissionGroup({ label, items, tone }: { label: string; items?: string[]; tone: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div style={{ ...groupLabel, color: tone }}>{label}</div>
      <div style={chipRow}>
        {items.map(op => <span key={op} style={chip}>{op}</span>)}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight:     '100dvh',
  background:    '#F7F9F6',
  padding:       '20px 16px 60px',
  maxWidth:      560,
  margin:        '0 auto',
  fontFamily:    'Arial, sans-serif',
  color:         '#171717',
};

const top: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           14,
  marginBottom:  18,
};

const backLink: React.CSSProperties = {
  alignSelf:      'flex-start',
  textDecoration: 'none',
  color:          '#4F46E5',
  fontWeight:     800,
  fontSize:       13,
};

const kicker: React.CSSProperties = {
  fontSize:      11,
  fontWeight:    800,
  textTransform: 'uppercase',
  color:         '#4F46E5',
};

const title: React.CSSProperties = {
  margin:    '4px 0 0',
  fontSize:  26,
  fontWeight:900,
  lineHeight: 1.1,
};

const metaBar: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           4,
  background:    '#FFFFFF',
  border:        '1px solid #D9E0D5',
  borderRadius:  12,
  padding:       12,
  marginBottom:  18,
  fontSize:      13,
};

const list: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           14,
};

const card: React.CSSProperties = {
  background:    '#FFFFFF',
  border:        '1px solid #D9E0D5',
  borderRadius:  12,
  padding:       16,
  boxShadow:     '0 10px 32px rgba(35, 45, 33, 0.06)',
};

const cardHead: React.CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'flex-start',
  gap:            12,
};

const agentTitle: React.CSSProperties = {
  fontWeight:    900,
  fontSize:      16,
};

const agentRole: React.CSSProperties = {
  marginTop:    4,
  color:        '#6B6F66',
  fontSize:     12,
  lineHeight:   1.5,
};

const statusPill: React.CSSProperties = {
  flexShrink:    0,
  padding:       '6px 10px',
  borderRadius:  999,
  fontWeight:    800,
  fontSize:      11,
  textTransform: 'uppercase',
};

const scopeNote: React.CSSProperties = {
  marginTop:    10,
  background:   '#F7F9F6',
  borderRadius: 8,
  padding:      '8px 10px',
  fontSize:     12,
  color:        '#6B6F66',
};

const groupLabel: React.CSSProperties = {
  fontSize:      11,
  fontWeight:    800,
  textTransform: 'uppercase',
  marginBottom:  4,
};

const chipRow: React.CSSProperties = {
  display: 'flex',
  flexWrap:'wrap',
  gap:     6,
};

const chip: React.CSSProperties = {
  background:    '#F7F9F6',
  border:        '1px solid #D9E0D5',
  padding:       '4px 10px',
  borderRadius:  999,
  fontSize:      11,
  fontWeight:    700,
};

const errorBox: React.CSSProperties = {
  background:    '#FFE2E2',
  border:        '1px solid #E9B8B8',
  borderRadius:  8,
  padding:       12,
  marginBottom:  16,
  color:         '#A33A3A',
  fontSize:      13,
};

const footer: React.CSSProperties = {
  marginTop:     24,
  textAlign:     'center',
  fontSize:      12,
  color:         '#6B6F66',
  fontWeight:    700,
};
