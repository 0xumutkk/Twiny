'use client';

import { useSendTransaction } from '@privy-io/react-auth';
import { useState } from 'react';

const monadExplorerUrl = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL ?? 'https://testnet.monadvision.com';

export interface ApprovalCardProps {
  campaignName:    string;
  rewardMON:       string;
  estimatedMinutes: number;
  riskLevel:       'low' | 'medium' | 'high';
  dataShared:      string[];
  onChainAction:   string;       // e.g. "claimReward(campaignId=1)"
  cloudUsed:       boolean;
  blocked:         boolean;
  blockReason?:    string;
  warnings?:       string[];
  // transaction data — undefined if blocked
  txTo?:           string;
  txData?:         string;
  onApprove?:      (txHash: string) => void;
  onReject?:       () => void;
}

const RISK_STYLES = {
  low:    { bg: '#DFF6ED', text: '#007A5E', label: 'Low' },
  medium: { bg: '#FDECC8', text: '#8A5A12', label: 'Medium' },
  high:   { bg: '#FFE2E2', text: '#A33A3A', label: 'High' },
};

export function ApprovalCard(props: ApprovalCardProps) {
  const {
    campaignName, rewardMON, estimatedMinutes, riskLevel,
    dataShared, onChainAction, cloudUsed,
    blocked, blockReason, warnings = [],
    txTo, txData, onApprove, onReject,
  } = props;

  const { sendTransaction } = useSendTransaction();
  const [status, setStatus] = useState<'idle' | 'signing' | 'done' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string>('');

  const risk = RISK_STYLES[riskLevel];

  async function handleApprove() {
    if (!txTo || !txData) return;
    setStatus('signing');
    try {
      // Privy renders its own native signing screen — Twiny never sees the signed payload
      const receipt = await sendTransaction({
        to:   txTo   as `0x${string}`,
        data: txData as `0x${string}`,
      });
      setTxHash(receipt.transactionHash);
      setStatus('done');
      onApprove?.(receipt.transactionHash);
    } catch (err) {
      console.error('[tx error]', err);
      setStatus('error');
    }
  }

  // ── Done state ────────────────────────────────────────────────
  if (status === 'done') {
    return (
      <div style={card}>
        <div style={doneMark}>Done</div>
        <div style={doneTitle}>Reward claimed</div>
        <div style={doneText}>{rewardMON} MON sent to your wallet</div>
        <a
          href={`${monadExplorerUrl}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          style={explorerLink}
        >
          View on Monad Explorer -&gt;
        </a>
      </div>
    );
  }

  // ── Main card ─────────────────────────────────────────────────
  return (
    <div style={card}>
      <div style={header}>
        <div>
          <div style={label}>
            {blocked ? 'Action blocked' : 'Awaiting approval'}
          </div>
          <div style={title}>{campaignName}</div>
        </div>
        <div style={{ ...riskPill, background: risk.bg, color: risk.text }}>
          {risk.label} risk
        </div>
      </div>

      {blocked && blockReason && (
        <div style={blockedNotice}>
          <strong>Blocked: </strong>{blockReason}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={warningNotice}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      <div style={summaryGrid}>
        <Metric label="Reward" value={`${rewardMON} MON`} tone="#007A5E" />
        <Metric label="Time" value={`~${estimatedMinutes} min`} />
      </div>

      <div style={fieldStack}>
        <Row label="Data shared"    value={dataShared.join(', ') || 'none'} />
        <Row label="On-chain call"  value={onChainAction} mono />
        <Row label="Cloud used"     value={cloudUsed ? 'Yes' : 'No'} valueColor={cloudUsed ? '#8A5A12' : '#007A5E'} />
      </div>

      <div style={actions}>
        <button onClick={onReject} style={btnReject}>
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={blocked || status === 'signing' || !txTo}
          style={blocked || !txTo ? btnDisabled : btnApprove}
        >
          {status === 'signing' ? 'Signing…' : blocked ? 'Blocked' : 'Approve in Wallet'}
        </button>
      </div>

      {status === 'error' && (
        <div style={errorText}>
          Transaction failed. Please try again.
        </div>
      )}

      <div style={privacyText}>
        Your keys stay in your wallet. Twiny prepares, you sign.
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={metric}>
      <span style={metricLabel}>{label}</span>
      <span style={{ ...metricValue, color: tone ?? '#171717' }}>{value}</span>
    </div>
  );
}

function Row({ label, value, valueColor, mono }: { label: string; value: string; valueColor?: string; mono?: boolean }) {
  return (
    <div style={row}>
      <span style={rowLabel}>{label}</span>
      <span style={{ ...rowValue, color: valueColor ?? '#171717', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   '#FFFFFF',
  border:       '1px solid #D9E0D5',
  borderRadius: 8,
  padding:      18,
  maxWidth:     420,
  width:        '100%',
  boxShadow:    '0 10px 32px rgba(35, 45, 33, 0.08)',
};

const header: React.CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'flex-start',
  gap:            14,
  marginBottom:   16,
};

const label: React.CSSProperties = {
  fontSize:      11,
  fontWeight:    800,
  color:         '#6B6F66',
  textTransform: 'uppercase',
};

const title: React.CSSProperties = {
  fontSize:   18,
  lineHeight: 1.25,
  fontWeight: 900,
  color:      '#171717',
  marginTop:  5,
};

const riskPill: React.CSSProperties = {
  flexShrink:    0,
  fontSize:      12,
  fontWeight:    800,
  padding:       '7px 11px',
  borderRadius:  999,
  whiteSpace:    'nowrap',
};

const blockedNotice: React.CSSProperties = {
  background:   '#FFE2E2',
  border:       '1px solid #E9B8B8',
  borderRadius: 8,
  padding:      '10px 12px',
  marginBottom: 14,
  fontSize:     13,
  color:        '#A33A3A',
  lineHeight:   1.5,
};

const warningNotice: React.CSSProperties = {
  background:   '#FDECC8',
  border:       '1px solid #F4D48A',
  borderRadius: 8,
  padding:      '9px 12px',
  marginBottom: 14,
  fontSize:     12,
  color:        '#5B4A2F',
  lineHeight:   1.5,
};

const summaryGrid: React.CSSProperties = {
  display:             'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap:                 10,
  marginBottom:        14,
};

const metric: React.CSSProperties = {
  borderRadius: 999,
  background:   '#F7F9F6',
  padding:      '12px 14px',
  minWidth:     0,
};

const metricLabel: React.CSSProperties = {
  display:    'block',
  color:      '#6B6F66',
  fontSize:   11,
  fontWeight: 800,
};

const metricValue: React.CSSProperties = {
  display:      'block',
  marginTop:    3,
  fontSize:     15,
  fontWeight:   900,
  whiteSpace:   'nowrap',
  overflow:     'hidden',
  textOverflow: 'ellipsis',
};

const fieldStack: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           10,
  marginBottom:  18,
};

const row: React.CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'flex-start',
  gap:            12,
};

const rowLabel: React.CSSProperties = {
  fontSize:   13,
  color:      '#6B6F66',
  flexShrink: 0,
  fontWeight: 700,
};

const rowValue: React.CSSProperties = {
  fontSize:  13,
  textAlign: 'right',
  wordBreak: 'break-word',
  minWidth:  0,
};

const actions: React.CSSProperties = {
  display: 'flex',
  gap:     10,
};

const errorText: React.CSSProperties = {
  fontSize:  12,
  color:     '#A33A3A',
  marginTop: 10,
  textAlign: 'center',
};

const privacyText: React.CSSProperties = {
  fontSize:   11,
  color:      '#6B6F66',
  marginTop:  14,
  textAlign:  'center',
  lineHeight: 1.5,
};

const doneMark: React.CSSProperties = {
  display:      'inline-flex',
  borderRadius: 999,
  background:   '#DFF6ED',
  color:        '#007A5E',
  padding:      '7px 12px',
  fontSize:     12,
  fontWeight:   900,
  marginBottom: 12,
};

const doneTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize:   17,
  color:      '#007A5E',
};

const doneText: React.CSSProperties = {
  fontSize:  13,
  color:     '#6B6F66',
  marginTop: 5,
};

const explorerLink: React.CSSProperties = {
  fontSize:      12,
  color:         '#4F46E5',
  marginTop:     12,
  display:       'inline-block',
  fontWeight:    800,
  textDecoration:'none',
};

const btnBase: React.CSSProperties = {
  flex:         1,
  padding:      '12px 0',
  borderRadius: 999,
  fontWeight:   800,
  fontSize:     14,
  cursor:       'pointer',
  border:       'none',
  transition:   'opacity 0.15s',
};

const btnReject:  React.CSSProperties = { ...btnBase, background: '#F7F9F6', color: '#171717' };
const btnApprove: React.CSSProperties = { ...btnBase, background: '#4F46E5', color: '#FFFFFF' };
const btnDisabled:React.CSSProperties = { ...btnBase, background: '#D9E0D5', color: '#7D8379', cursor: 'not-allowed' };
