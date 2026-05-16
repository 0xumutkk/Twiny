'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useCallback } from 'react';
import { VoiceButton } from '../components/voice/VoiceButton';
import { ApprovalCard, type ApprovalCardProps } from '../components/approval/ApprovalCard';
import { useVoice } from '../hooks/useVoice';

// Default user profile — in production this lives in the Local Memory Vault
const DEFAULT_PROFILE = {
  interests:     ['defi', 'tooling', 'ai'],
  riskTolerance: 'low' as const,
  minRewardMON:  0.5,
  maxMinutes:    10,
};

type CardState = (Omit<ApprovalCardProps, 'onApprove' | 'onReject'>) | null;

export default function Home() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets }                             = useWallets();
  const wallet                                  = wallets[0];

  const [cardState, setCardState]   = useState<CardState>(null);
  const [agentLog,  setAgentLog]    = useState<string>('');

  // ── Handle transcript from voice or text input ────────────────
  const handleTranscript = useCallback(async (text: string) => {
    if (!wallet?.address) return;
    setAgentLog('Running agents…');
    setCardState(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/agent/run`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            transcript:    text,
            walletAddress: wallet.address,
            profile:       DEFAULT_PROFILE,
          }),
        }
      );

      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      const data = await res.json();

      // Speak the voice response
      await voice.speak(data.voiceResponse);

      // Show the top opportunity as an Approval Card
      const top = data.opportunities?.[0];
      if (top) {
        const policy   = top.policyResult;
        const campaign = top.campaign;

        setCardState({
          campaignName:     campaign.name,
          rewardMON:        campaign.rewardMON,
          estimatedMinutes: campaign.estimatedMinutes,
          riskLevel:        campaign.riskLevel as 'low' | 'medium' | 'high',
          dataShared:       ['wallet address'],
          onChainAction:    `claimReward(campaignId=${campaign.campaignId})`,
          cloudUsed:        false,
          blocked:          policy.blocked,
          blockReason:      policy.blockReason,
          warnings:         policy.warnings,
          txTo:             process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
          txData:           data.topAction?.calldata,
        });
      }

      setAgentLog(data.voiceResponse);
    } catch (err) {
      console.error(err);
      setAgentLog('Agent pipeline error. Check console.');
    }
  }, [wallet?.address]);

  const voice = useVoice({ onTranscript: handleTranscript });

  // ── Text fallback input ───────────────────────────────────────
  const [textInput, setTextInput] = useState('');
  const shortWallet = wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'No wallet';

  const submitTextInput = () => {
    const command = textInput.trim();
    if (!command) return;
    handleTranscript(command);
    setTextInput('');
  };

  if (!ready) {
    return (
      <Screen>
        <div style={loadingPill}>Loading...</div>
      </Screen>
    );
  }

  if (!authenticated) {
    return (
      <Screen>
        <section style={heroPanel}>
          <div style={brandMark}>Tw</div>
          <p style={eyebrow}>Private agent</p>
          <h1 style={headline}>Twiny</h1>
          <p style={supportingCopy}>Your local twin for wallet actions, quick approvals and voice-first tasks.</p>
          <div style={previewStack} aria-hidden="true">
            <div style={{ ...previewPill, width: '72%' }} />
            <div style={{ ...previewPill, width: '88%', background: '#DFF6ED' }} />
            <div style={{ ...previewPill, width: '58%', background: '#FDECC8' }} />
          </div>
          <button onClick={login} style={primaryPill}>
            Connect Wallet
          </button>
        </section>
      </Screen>
    );
  }

  return (
    <Screen>
      <section style={appShell}>
        <header style={topBar}>
          <div style={brandCluster}>
            <div style={brandDot}>T</div>
            <div>
              <div style={appTitle}>Twiny</div>
              <div style={caption}>Monad Testnet</div>
            </div>
          </div>
          <button onClick={logout} style={ghostPill}>Disconnect</button>
        </header>

        <div style={walletPill}>
          <span style={walletLabel}>Wallet</span>
          <span style={walletAddress}>{shortWallet}</span>
        </div>

        <main style={workspace}>
          <VoiceButton
            state={voice.state}
            transcript={voice.transcript}
            onPress={voice.startRecording}
            onRelease={voice.stopRecording}
          />

          {agentLog && (
            <div style={agentMessage}>
              {agentLog}
            </div>
          )}

          {cardState ? (
            <div style={approvalSlot}>
              <ApprovalCard
                {...cardState}
                onApprove={(hash) => {
                  setAgentLog(`Done. TX: ${hash.slice(0, 10)}...`);
                  setCardState(null);
                }}
                onReject={() => {
                  setAgentLog('Action rejected. No changes made.');
                  setCardState(null);
                }}
              />
            </div>
          ) : (
            <div style={emptyState}>
              <div style={emptyStateTitle}>Ready for a task</div>
              <div style={emptyStateText}>Ask Twiny to scan opportunities, prepare a claim or explain the next wallet action.</div>
            </div>
          )}
        </main>

        <div style={commandBar}>
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitTextInput(); }}
            placeholder="Type a command"
            style={textInputStyle}
          />
          <button onClick={submitTextInput} disabled={!textInput.trim()} style={!textInput.trim() ? sendPillDisabled : sendPill}>
            Send
          </button>
        </div>
      </section>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight:      '100dvh',
      background:     '#F7F9F6',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'flex-start',
      padding:        '0 16px',
      gap:            0,
      color:          '#171717',
    }}>
      {children}
    </main>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const appShell: React.CSSProperties = {
  minHeight:      '100dvh',
  width:          '100%',
  maxWidth:       430,
  display:        'flex',
  flexDirection:  'column',
  padding:        '18px 0 16px',
};

const topBar: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  gap:            12,
  padding:        '6px 0 14px',
};

const brandCluster: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        10,
  minWidth:   0,
};

const brandDot: React.CSSProperties = {
  width:          42,
  height:         42,
  borderRadius:   999,
  background:     '#171717',
  color:          '#FFFFFF',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  fontWeight:     800,
  fontSize:       16,
};

const appTitle: React.CSSProperties = {
  fontSize:   24,
  lineHeight: 1,
  fontWeight: 800,
  color:      '#171717',
};

const caption: React.CSSProperties = {
  marginTop:  5,
  color:      '#6B6F66',
  fontSize:   12,
  fontWeight: 600,
};

const ghostPill: React.CSSProperties = {
  background:   '#FFFFFF',
  color:        '#4B5048',
  border:       '1px solid #D9E0D5',
  borderRadius: 999,
  padding:      '10px 14px',
  cursor:       'pointer',
  fontSize:     13,
  fontWeight:   700,
};

const walletPill: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  gap:            12,
  minHeight:      46,
  borderRadius:   999,
  padding:        '8px 10px 8px 18px',
  background:     '#FFFFFF',
  border:         '1px solid #D9E0D5',
  boxShadow:      '0 10px 32px rgba(35, 45, 33, 0.06)',
};

const walletLabel: React.CSSProperties = {
  color:      '#6B6F66',
  fontSize:   12,
  fontWeight: 700,
};

const walletAddress: React.CSSProperties = {
  borderRadius: 999,
  padding:      '8px 12px',
  background:   '#EEF5FF',
  color:        '#264C7A',
  fontSize:     12,
  fontWeight:   800,
  whiteSpace:   'nowrap',
};

const workspace: React.CSSProperties = {
  flex:           1,
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'stretch',
  justifyContent: 'center',
  gap:            18,
  padding:        '26px 0 18px',
};

const agentMessage: React.CSSProperties = {
  borderRadius: 999,
  background:   '#FFFFFF',
  border:       '1px solid #D9E0D5',
  color:        '#4B5048',
  padding:      '12px 16px',
  textAlign:    'center',
  fontSize:     13,
  lineHeight:   1.45,
  fontWeight:   600,
};

const approvalSlot: React.CSSProperties = {
  width:    '100%',
  display:  'flex',
  justifyContent: 'center',
};

const emptyState: React.CSSProperties = {
  border:       '1px solid #D9E0D5',
  borderRadius: 8,
  background:   '#FFFFFF',
  padding:      18,
  boxShadow:    '0 10px 32px rgba(35, 45, 33, 0.06)',
};

const emptyStateTitle: React.CSSProperties = {
  color:      '#171717',
  fontSize:   16,
  fontWeight: 800,
};

const emptyStateText: React.CSSProperties = {
  color:      '#6B6F66',
  fontSize:   13,
  lineHeight: 1.55,
  marginTop:  6,
};

const commandBar: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          8,
  borderRadius: 999,
  background:   '#FFFFFF',
  border:       '1px solid #D9E0D5',
  padding:      8,
  boxShadow:    '0 12px 36px rgba(35, 45, 33, 0.10)',
};

const textInputStyle: React.CSSProperties = {
  flex:       1,
  minWidth:   0,
  padding:    '12px 10px 12px 14px',
  border:     'none',
  fontSize:   14,
  background: 'transparent',
  outline:    'none',
  color:      '#171717',
};

const sendPill: React.CSSProperties = {
  border:       'none',
  borderRadius: 999,
  padding:      '12px 18px',
  background:   '#4F46E5',
  color:        '#FFFFFF',
  fontWeight:   800,
  cursor:       'pointer',
  fontSize:     13,
};

const sendPillDisabled: React.CSSProperties = {
  ...sendPill,
  background: '#D9E0D5',
  color:      '#7D8379',
  cursor:     'not-allowed',
};

const loadingPill: React.CSSProperties = {
  marginTop:     '44vh',
  borderRadius:  999,
  padding:       '12px 18px',
  background:    '#FFFFFF',
  border:        '1px solid #D9E0D5',
  color:         '#6B6F66',
  fontSize:      13,
  fontWeight:    700,
};

const heroPanel: React.CSSProperties = {
  minHeight:      '100dvh',
  width:          '100%',
  maxWidth:       430,
  display:        'flex',
  flexDirection:  'column',
  justifyContent: 'center',
  alignItems:     'stretch',
  padding:        '24px 0',
};

const brandMark: React.CSSProperties = {
  width:          68,
  height:         68,
  borderRadius:   999,
  background:     '#171717',
  color:          '#FFFFFF',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  fontWeight:     900,
  fontSize:       22,
};

const eyebrow: React.CSSProperties = {
  margin:        '26px 0 8px',
  color:         '#4F46E5',
  fontSize:      12,
  fontWeight:    800,
  textTransform: 'uppercase',
};

const headline: React.CSSProperties = {
  fontSize:      48,
  lineHeight:    1,
  fontWeight:    900,
  color:         '#171717',
  margin:        0,
  letterSpacing: 0,
};

const supportingCopy: React.CSSProperties = {
  margin:     '14px 0 0',
  color:      '#4B5048',
  fontSize:   15,
  lineHeight: 1.55,
  maxWidth:   330,
};

const previewStack: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'flex-start',
  gap:           10,
  margin:        '34px 0',
};

const previewPill: React.CSSProperties = {
  height:       28,
  borderRadius: 999,
  background:   '#EEF5FF',
};

const primaryPill: React.CSSProperties = {
  width:        '100%',
  border:       'none',
  borderRadius: 999,
  padding:      '16px 22px',
  background:   '#4F46E5',
  color:        '#FFFFFF',
  fontWeight:   900,
  cursor:       'pointer',
  fontSize:     15,
};
