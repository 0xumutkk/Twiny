'use client';

import { useSendTransaction } from '@privy-io/react-auth';
import { useState } from 'react';
import { Icon, Presence, RiskBadge, TwinOrb } from '../ui/TwinyPrimitives';

const monadExplorerUrl = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL ?? 'https://testnet.monadvision.com';

export interface ApprovalCardProps {
  campaignName:     string;
  rewardMON:        string;
  estimatedMinutes: number;
  riskLevel:        'low' | 'medium' | 'high';
  dataShared:       string[];
  onChainAction:    string;
  cloudUsed:        boolean;
  blocked:          boolean;
  blockReason?:     string;
  warnings?:        string[];
  txTo?:            string;
  txData?:          string;
  txValue?:         string;           // hex string for native MON transfers e.g. "0x..."
  onApprove?:       (txHash: string) => void;
  onReject?:        () => void;
}

export function ApprovalCard(props: ApprovalCardProps) {
  const {
    campaignName, rewardMON, estimatedMinutes, riskLevel,
    dataShared, onChainAction, cloudUsed,
    blocked, blockReason, warnings = [],
    txTo, txData, txValue, onApprove, onReject,
  } = props;

  const { sendTransaction } = useSendTransaction();
  const [status, setStatus] = useState<'idle' | 'signing' | 'done' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');
  const isHigh = riskLevel === 'high' || blocked;
  const isMedium = riskLevel === 'medium';

  async function handleApprove() {
    if (!txTo || !txData || blocked) return;
    setStatus('signing');
    try {
      const receipt = await sendTransaction({
        to:    txTo   as `0x${string}`,
        data:  txData as `0x${string}`,
        ...(txValue ? { value: BigInt(txValue) } : {}),
      });
      const hash = receipt.transactionHash ?? (receipt as unknown as { hash: string }).hash;
      setTxHash(hash);
      setStatus('done');
      onApprove?.(hash);
    } catch (err) {
      console.error('[tx error]', err);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <section style={successWrap}>
        <Presence tone="settled" />
        <h2 className="tw-serif" style={successAmount}>
          +{rewardMON}
          <span className="tw-mono" style={successUnit}>MON</span>
        </h2>
        <p style={successCopy}>settled on monad</p>
        <div style={receipt}>
          <KV k="tx" v={shortHash(txHash)} mono />
          <div className="tw-hr" />
          <KV k="reward" v={`${rewardMON} MON`} mono />
          <div className="tw-hr" />
          <KV k="fee" v="wallet quoted" mono />
        </div>
        <a href={`${monadExplorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer" style={explorerLink}>
          View transaction <Icon name="arrow-right" size={14} strokeWidth={2} />
        </a>
      </section>
    );
  }

  if (status === 'signing') {
    return (
      <section style={signingWrap}>
        <div style={handoffVisual}>
          <TwinOrb size={50} style={{ position: 'absolute', top: 0, left: 0 }} />
          <div style={walletTile}>
            <Icon name="wallet" size={24} color="var(--tw-text)" strokeWidth={1.5} />
          </div>
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: 'absolute', inset: 0 }}>
            <path d="M 36 36 Q 55 55 78 78" stroke="var(--tw-text-tertiary)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="tw-serif" style={signingTitle}>Sign in your wallet.</h2>
        <div style={spinnerRow}>
          <span style={spinner} />
          <span>waiting...</span>
        </div>
      </section>
    );
  }

  return (
    <section style={{ ...approvalWrap, background: isHigh ? 'var(--tw-danger-soft)' : 'transparent' }}>
      <div style={approvalHeader}>
        <RiskBadge level={riskLevel} size="md" />
        <Presence tone={isHigh || isMedium ? 'warn' : 'alive'} />
      </div>

      <h2 className="tw-serif" style={approvalTitle}>
        {isHigh ? 'Approve this wallet action?' : `Claim ${rewardMON} MON from ${campaignName}?`}
      </h2>

      <div className="tw-card" style={{ ...actionCard, borderColor: isHigh ? 'var(--tw-danger)' : 'var(--tw-border)' }}>
        <div style={{ ...actionStripe, background: isHigh ? 'var(--tw-danger-soft)' : 'var(--tw-card-warm)' }}>
          <div style={sectionLabel}>On-chain action</div>
          <div className="tw-mono" style={{ ...actionCode, color: isHigh ? 'var(--tw-danger)' : 'var(--tw-text)' }}>
            {onChainAction}
          </div>
        </div>

        <div style={{ padding: '4px 16px' }}>
          <KV k="Reward" v={`${rewardMON} MON`} mono valueColor={isHigh ? 'var(--tw-text-secondary)' : 'var(--tw-monad-deep)'} />
          <div className="tw-hr" />
          <KV k="Time" v={`~${estimatedMinutes} min`} />
          <div className="tw-hr" />
          <KV k="Data" v={dataShared.join(', ') || 'none'} />
          <div className="tw-hr" />
          <KV k="Cloud" v={cloudUsed ? 'Used' : 'Not used'} valueColor={cloudUsed ? 'var(--tw-warn)' : 'var(--tw-ok)'} />
        </div>

        {(isHigh || warnings.length > 0) && (
          <div style={{ ...riskNote, background: isHigh ? 'var(--tw-danger-soft)' : 'var(--tw-warn-soft)' }}>
            <div style={riskNoteTitle}>
              <Icon name="shield" size={15} color={isHigh ? 'var(--tw-danger)' : 'var(--tw-warn)'} strokeWidth={1.8} />
              <span>{isHigh ? 'Twiny pushed back' : 'Twiny noticed'}</span>
            </div>
            <ul style={riskList}>
              {blockReason && <li>{blockReason}</li>}
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}

        {!isHigh && (
          <div style={preparedNote}>
            <Presence tone={isMedium ? 'warn' : 'alive'} />
            <span>{isMedium ? 'Confirm the recipient before approving.' : 'Prepared. Your wallet signs.'}</span>
          </div>
        )}
      </div>

      <div style={actions}>
        <button type="button" onClick={onReject} className="tw-press" style={rejectButton}>Reject</button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={blocked || !txTo || !txData}
          className="tw-press"
          style={{
            ...approveButton,
            background: blocked || !txTo || !txData ? 'rgba(255,69,58,0.18)' : 'var(--tw-ink-stamp)',
            color: blocked || !txTo || !txData ? 'var(--tw-danger)' : 'var(--tw-text-inverse)',
            cursor: blocked || !txTo || !txData ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon name="lock" size={15} strokeWidth={2} color={blocked || !txTo || !txData ? 'var(--tw-danger)' : 'var(--tw-text-inverse)'} />
          {blocked ? 'Blocked by policy' : 'Approve in wallet'}
        </button>
      </div>

      {status === 'error' && <div style={errorText}>Transaction failed. Please try again.</div>}
    </section>
  );
}

function KV({ k, v, mono, valueColor }: { k: string; v: string; mono?: boolean; valueColor?: string }) {
  return (
    <div style={kv}>
      <span style={kvKey}>{k}</span>
      <span className={mono ? 'tw-mono' : undefined} style={{ ...kvValue, color: valueColor ?? 'var(--tw-text)' }}>{v}</span>
    </div>
  );
}

function shortHash(hash: string) {
  if (!hash) return 'pending';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

const approvalWrap: React.CSSProperties = {
  borderRadius: 'var(--tw-r-xl)',
  padding:      '18px 0 0',
};

const approvalHeader: React.CSSProperties = {
  display:        'flex',
  justifyContent: 'space-between',
  alignItems:     'center',
  padding:        '0 8px 14px',
};

const approvalTitle: React.CSSProperties = {
  margin:     '0 8px 18px',
  color:      'var(--tw-text)',
  fontSize:   30,
  lineHeight: 1.05,
};

const actionCard: React.CSSProperties = {
  overflow:     'hidden',
  borderWidth:  1,
  borderStyle:  'solid',
};

const actionStripe: React.CSSProperties = {
  padding:      '14px 16px',
  borderBottom: '0.5px solid var(--tw-border-hair)',
};

const sectionLabel: React.CSSProperties = {
  color:         'var(--tw-text-tertiary)',
  marginBottom:  4,
  fontSize:      10.5,
  fontWeight:    600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const actionCode: React.CSSProperties = {
  fontSize:   13,
  fontWeight: 600,
  wordBreak:  'break-all',
};

const kv: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  gap:            16,
  minHeight:      47,
};

const kvKey: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 13,
};

const kvValue: React.CSSProperties = {
  color:     'var(--tw-text)',
  fontSize:  13,
  textAlign: 'right',
  minWidth:  0,
  wordBreak: 'break-word',
};

const riskNote: React.CSSProperties = {
  padding:   '14px 16px',
  borderTop: '0.5px solid var(--tw-border-hair)',
};

const riskNoteTitle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          8,
  marginBottom: 8,
  color:        'var(--tw-text)',
  fontSize:     12.5,
  fontWeight:   600,
};

const riskList: React.CSSProperties = {
  margin:      0,
  paddingLeft: 18,
  color:       'var(--tw-text-secondary)',
  fontSize:    12.5,
  lineHeight:  1.45,
};

const preparedNote: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        10,
  padding:    '14px 16px',
  borderTop:  '0.5px solid var(--tw-border-hair)',
  background: 'var(--tw-card-warm)',
  color:      'var(--tw-text-secondary)',
  fontSize:   12.5,
};

const actions: React.CSSProperties = {
  display:    'flex',
  gap:        10,
  marginTop:  16,
};

const rejectButton: React.CSSProperties = {
  flex:         1,
  padding:      16,
  borderRadius: 'var(--tw-r)',
  background:   'transparent',
  border:       '0.5px solid var(--tw-border-strong)',
  color:        'var(--tw-text)',
  fontSize:     14,
  fontWeight:   600,
};

const approveButton: React.CSSProperties = {
  flex:           1.45,
  padding:        16,
  borderRadius:   'var(--tw-r)',
  border:         'none',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            8,
  fontSize:       14,
  fontWeight:     600,
};

const errorText: React.CSSProperties = {
  marginTop: 12,
  color:     'var(--tw-danger)',
  fontSize:  12,
  textAlign: 'center',
};

const signingWrap: React.CSSProperties = {
  minHeight:      380,
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  padding:        '36px 24px',
};

const handoffVisual: React.CSSProperties = {
  position: 'relative',
  width:    110,
  height:   110,
};

const walletTile: React.CSSProperties = {
  position:       'absolute',
  bottom:         0,
  right:          0,
  width:          50,
  height:         50,
  borderRadius:   14,
  background:     'var(--tw-card-elevated)',
  border:         '0.5px solid var(--tw-border)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  boxShadow:      '0 4px 16px rgba(0,0,0,0.3)',
};

const signingTitle: React.CSSProperties = {
  marginTop:  40,
  fontSize:   28,
  lineHeight: 1.1,
  textAlign:  'center',
};

const spinnerRow: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        10,
  marginTop:  34,
  color:      'var(--tw-text-tertiary)',
  fontSize:   12,
};

const spinner: React.CSSProperties = {
  width:          12,
  height:         12,
  borderRadius:   6,
  border:         '2px solid rgba(255,255,255,0.12)',
  borderTopColor: 'var(--tw-monad)',
  animation:      'tw-spin 0.9s linear infinite',
};

const successWrap: React.CSSProperties = {
  padding:      '28px 8px',
  textAlign:    'center',
  animation:    'tw-fade 0.5s ease-out',
};

const successAmount: React.CSSProperties = {
  display:        'flex',
  alignItems:     'baseline',
  justifyContent: 'center',
  gap:            10,
  margin:         '24px 0 0',
  fontSize:       62,
  lineHeight:     0.95,
};

const successUnit: React.CSSProperties = {
  color:      'var(--tw-text-tertiary)',
  fontSize:   20,
  fontWeight: 600,
};

const successCopy: React.CSSProperties = {
  color:      'var(--tw-text-tertiary)',
  marginTop:  18,
  fontSize:   12,
  letterSpacing: 0.3,
};

const receipt: React.CSSProperties = {
  marginTop: 42,
};

const explorerLink: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  gap:            6,
  marginTop:      24,
  color:          'var(--tw-monad-deep)',
  fontSize:       13,
  fontWeight:     600,
  textDecoration: 'none',
};
