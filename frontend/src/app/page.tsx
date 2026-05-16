'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApprovalCard, type ApprovalCardProps } from '../components/approval/ApprovalCard';
import { DockMicButton, VoiceButton } from '../components/voice/VoiceButton';
import { AgentDot, Icon, Presence, RiskBadge, TwinOrb } from '../components/ui/TwinyPrimitives';
import { useVoice } from '../hooks/useVoice';

const DEFAULT_PROFILE = {
  interests:     ['defi', 'tooling', 'ai'],
  riskTolerance: 'low' as const,
  minRewardMON:  0.5,
  maxMinutes:    10,
};

type CardState = (Omit<ApprovalCardProps, 'onApprove' | 'onReject'>) | null;

export default function Home() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [cardState, setCardState] = useState<CardState>(null);
  const [agentLog, setAgentLog] = useState('');
  const [textInput, setTextInput] = useState('');
  const speakRef = useRef<(text: string) => Promise<void>>(async () => {});

  const shortWallet = wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'No wallet';
  const today = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date()).replace(',', ' ·');
  }, []);

  const handleTranscript = useCallback(async (text: string) => {
    if (!wallet?.address) {
      setAgentLog('Connect a wallet before asking Twiny to prepare an action.');
      return;
    }

    setAgentLog('Thinking across mail, wallet and policy...');
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

      await speakRef.current(data.voiceResponse);

      const top = data.opportunities?.[0];
      if (top) {
        const policy = top.policyResult;
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
      setAgentLog('Agent pipeline error. Check the backend console.');
    }
  }, [wallet?.address]);

  const voice = useVoice({ onTranscript: handleTranscript });
  speakRef.current = voice.speak;

  const submitTextInput = () => {
    const command = textInput.trim();
    if (!command) return;
    handleTranscript(command);
    setTextInput('');
  };

  if (!ready) {
    return (
      <Screen>
        <main className="tw-mobile" style={centered}>
          <TwinOrb size={58} thinking />
          <div style={loadingCopy}>Loading Twiny...</div>
        </main>
      </Screen>
    );
  }

  if (!authenticated) {
    return (
      <Screen>
        <main className="tw-mobile" style={onboarding}>
          <div style={onboardingTop}>
            <Presence tone="alive" />
            <span className="tw-mono" style={stepText}>01 / 04</span>
          </div>

          <div style={onboardingHero}>
            <TwinOrb size={118} listening />
            <h1 className="tw-serif" style={onboardingTitle}>
              Your twin lives with you.
            </h1>
            <p style={onboardingCopy}>
              Twiny reads, reasons and prepares wallet actions. Your wallet signs every transaction.
            </p>
          </div>

          <button type="button" onClick={login} className="tw-press" style={primaryButton}>
            Connect Wallet
            <Icon name="arrow-right" size={16} strokeWidth={2.2} />
          </button>
        </main>
      </Screen>
    );
  }

  return (
    <Screen>
      <main className="tw-mobile">
        <header style={topBar}>
          <span className="tw-mono" style={dateText}>{today}</span>
          <Presence tone={cardState?.blocked ? 'warn' : 'alive'} />
        </header>

        <section style={walletStrip}>
          <div style={walletIdentity}>
            <TwinOrb size={26} />
            <div>
              <div style={walletTitle}>Twiny</div>
              <div style={walletSub}>on-device</div>
            </div>
          </div>
          <button type="button" onClick={logout} className="tw-press" style={walletButton}>
            {shortWallet}
          </button>
        </section>

        {cardState ? (
          <section style={focusedArea}>
            <ApprovalCard
              {...cardState}
              onApprove={(hash) => {
                setAgentLog(`Settled. TX ${hash.slice(0, 10)}...`);
                setCardState(null);
              }}
              onReject={() => {
                setAgentLog('Action rejected. No changes made.');
                setCardState(null);
              }}
            />
          </section>
        ) : (
          <>
            <section style={headlineBlock}>
              <h1 className="tw-serif" style={headline}>
                Good morning.
              </h1>
            </section>

            <button
              type="button"
              onClick={() => handleTranscript('Check my mail and wallet. Anything I should act on today?')}
              className="tw-press tw-card"
              style={featuredAction}
            >
              <div style={featuredInner}>
                <h2 className="tw-serif" style={featuredTitle}>
                  Ask for your daily wallet brief.
                </h2>
                <div style={metricRow}>
                  <Metric value="1.2" suffix="MON" />
                  <Metric value="2" suffix="min" />
                  <Metric value="low" tone="var(--tw-ok)" />
                </div>
              </div>
              <div style={featuredFooter}>
                <RiskBadge level="low" />
                <span style={reviewLink}>
                  Review
                  <Icon name="arrow-right" size={14} strokeWidth={2} />
                </span>
              </div>
            </button>

            <section style={stream}>
              <DividerLabel label="also today" />
              <NoteRow agent="mail" headline="Reply drafted for Prometeia" time="14m" />
              <NoteRow agent="calendar" headline="Two open slots tomorrow morning" time="1h" />
              <NoteRow agent="risk" headline="One contract flagged" time="3h" tone="warn" />
            </section>

            <VoiceButton
              state={voice.state}
              transcript={voice.transcript}
              onPress={voice.startRecording}
              onRelease={voice.stopRecording}
              onToggle={voice.toggleRecording}
            />
          </>
        )}

        {agentLog && <div style={agentMessage}>{agentLog}</div>}

        <section style={composer}>
          <input
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitTextInput();
            }}
            placeholder="Type a command"
            className="tw-field"
            style={composerInput}
          />
          <button type="button" onClick={submitTextInput} disabled={!textInput.trim()} className="tw-press" style={textInput.trim() ? sendButton : sendButtonDisabled} aria-label="Send command">
            <Icon name="arrow-right" size={17} strokeWidth={2.3} color={textInput.trim() ? 'var(--tw-text-inverse)' : 'var(--tw-text-tertiary)'} />
          </button>
        </section>

        <BottomDock
          state={voice.state}
          onMicPress={voice.startRecording}
          onMicRelease={voice.stopRecording}
          onMicToggle={voice.toggleRecording}
        />
      </main>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="tw-screen">{children}</div>;
}

function Metric({ value, suffix, tone }: { value: string; suffix?: string; tone?: string }) {
  return (
    <div className="tw-serif" style={{ ...metricValue, color: tone ?? 'var(--tw-text)' }}>
      {value}
      {suffix && <span className="tw-mono" style={metricSuffix}>{suffix}</span>}
    </div>
  );
}

function DividerLabel({ label }: { label: string }) {
  return (
    <div style={dividerLabel}>
      <span style={dividerLine} />
      <span>{label}</span>
      <span style={dividerLine} />
    </div>
  );
}

function NoteRow({ agent, headline, time, tone }: {
  agent: 'mail' | 'calendar' | 'risk';
  headline: string;
  time: string;
  tone?: 'warn';
}) {
  return (
    <button type="button" className="tw-press" style={noteRow} aria-label={headline}>
      <AgentDot agent={agent} size={8} />
      <span style={{ ...noteHeadline, color: tone === 'warn' ? 'var(--tw-warn)' : 'var(--tw-text)' }}>{headline}</span>
      <span className="tw-mono" style={noteTime}>{time}</span>
    </button>
  );
}

function BottomDock({ state, onMicPress, onMicRelease, onMicToggle }: {
  state: ReturnType<typeof useVoice>['state'];
  onMicPress: () => void;
  onMicRelease: () => void;
  onMicToggle: () => void;
}) {
  const router = useRouter();

  const routes: Record<string, string> = {
    home:     '/',
    inbox:    '/',
    shield:   '/permissions',
    settings: '/',
  };

  return (
    <nav style={bottomDock} aria-label="Primary">
      <DockItem icon="home" active onClick={() => router.push(routes.home)} />
      <DockItem icon="inbox" onClick={() => router.push(routes.inbox)} />
      <div style={dockCenter}>
        <DockMicButton state={state} onPress={onMicPress} onRelease={onMicRelease} onToggle={onMicToggle} />
      </div>
      <DockItem icon="shield" onClick={() => router.push(routes.shield)} />
      <DockItem icon="settings" onClick={() => router.push(routes.settings)} />
    </nav>
  );
}

function DockItem({ icon, active = false, onClick }: { icon: 'home' | 'inbox' | 'shield' | 'settings'; active?: boolean; onClick?: () => void }) {
  const labels = {
    home: 'Today',
    inbox: 'Inbox',
    shield: 'Trust controls',
    settings: 'Settings',
  };

  return (
    <button type="button" aria-label={labels[icon]} onClick={onClick} className="tw-press" style={{ ...dockItem, color: active ? 'var(--tw-text)' : 'var(--tw-text-tertiary)' }}>
      <Icon name={icon} size={20} strokeWidth={active ? 2 : 1.5} />
    </button>
  );
}

const centered: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  flexDirection:  'column',
  gap:            18,
};

const loadingCopy: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 13,
};

const onboarding: React.CSSProperties = {
  display:        'flex',
  flexDirection:  'column',
  justifyContent: 'space-between',
};

const onboardingTop: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
};

const stepText: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 11,
};

const onboardingHero: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'flex-start',
  gap:           24,
};

const onboardingTitle: React.CSSProperties = {
  margin:     0,
  fontSize:   54,
  lineHeight: 0.95,
};

const onboardingCopy: React.CSSProperties = {
  margin:     0,
  color:      'var(--tw-text-secondary)',
  fontSize:   15,
  lineHeight: 1.55,
  maxWidth:   330,
};

const primaryButton: React.CSSProperties = {
  width:          '100%',
  padding:        '16px 22px',
  borderRadius:   'var(--tw-r)',
  background:     'var(--tw-ink-stamp)',
  border:         'none',
  color:          'var(--tw-text-inverse)',
  fontSize:       14,
  fontWeight:     700,
  cursor:         'pointer',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            8,
};

const topBar: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        '0 8px 24px',
};

const dateText: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 11,
};

const walletStrip: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  gap:            12,
  marginBottom:   26,
};

const walletIdentity: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        10,
};

const walletTitle: React.CSSProperties = {
  color:      'var(--tw-text)',
  fontSize:   13,
  fontWeight: 600,
};

const walletSub: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 11,
};

const walletButton: React.CSSProperties = {
  border:       '0.5px solid var(--tw-border)',
  borderRadius: 999,
  background:   'rgba(255,255,255,0.06)',
  color:        'var(--tw-text-secondary)',
  padding:      '9px 12px',
  fontSize:     12,
  cursor:       'pointer',
};

const focusedArea: React.CSSProperties = {
  paddingBottom: 22,
};

const headlineBlock: React.CSSProperties = {
  padding: '0 8px 26px',
};

const headline: React.CSSProperties = {
  margin:     0,
  color:      'var(--tw-text)',
  fontSize:   45,
  lineHeight: 0.98,
};

const featuredAction: React.CSSProperties = {
  width:      '100%',
  padding:    0,
  textAlign:  'left',
  border:     'none',
  overflow:   'hidden',
};

const featuredInner: React.CSSProperties = {
  padding: '22px 22px 20px',
};

const featuredTitle: React.CSSProperties = {
  margin:     0,
  color:      'var(--tw-text)',
  fontSize:   32,
  lineHeight: 1.05,
};

const metricRow: React.CSSProperties = {
  display:    'flex',
  gap:        30,
  marginTop:  28,
  alignItems: 'baseline',
};

const metricValue: React.CSSProperties = {
  fontSize:   30,
  lineHeight: 1,
};

const metricSuffix: React.CSSProperties = {
  marginLeft: 5,
  color:      'var(--tw-text-tertiary)',
  fontSize:   11,
  fontWeight: 600,
};

const featuredFooter: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        '14px 20px',
  borderTop:      '0.5px solid var(--tw-border-hair)',
};

const reviewLink: React.CSSProperties = {
  display:    'inline-flex',
  alignItems: 'center',
  gap:        6,
  color:      'var(--tw-monad-deep)',
  fontSize:   13,
  fontWeight: 600,
};

const stream: React.CSSProperties = {
  padding: '34px 8px 22px',
};

const dividerLabel: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  gap:            10,
  marginBottom:   8,
  color:          'var(--tw-text-tertiary)',
  fontSize:       10.5,
  fontWeight:     600,
  letterSpacing:  0.4,
  textTransform:  'uppercase',
};

const dividerLine: React.CSSProperties = {
  flex:       1,
  height:     1,
  background: 'var(--tw-border-hair)',
};

const noteRow: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          14,
  width:        '100%',
  padding:      '16px 0',
  textAlign:    'left',
  border:       'none',
  borderBottom: '0.5px solid var(--tw-border-hair)',
  background:   'transparent',
};

const noteHeadline: React.CSSProperties = {
  flex:         1,
  minWidth:     0,
  fontSize:     14,
  fontWeight:   500,
  overflow:     'hidden',
  textOverflow: 'ellipsis',
  whiteSpace:   'nowrap',
};

const noteTime: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 11,
};

const agentMessage: React.CSSProperties = {
  margin:       '18px 0 14px',
  color:        'var(--tw-text-secondary)',
  background:   'rgba(255,255,255,0.06)',
  border:       '0.5px solid var(--tw-border)',
  borderRadius: 'var(--tw-r)',
  padding:      '12px 14px',
  fontSize:     12.5,
  lineHeight:   1.45,
};

const composer: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        9,
  padding:    '12px 0 88px',
};

const composerInput: React.CSSProperties = {
  height: 48,
  padding: '0 15px',
};

const sendButton: React.CSSProperties = {
  width:          48,
  height:         48,
  borderRadius:   'var(--tw-r)',
  border:         'none',
  background:     'var(--tw-ink-stamp)',
  color:          'var(--tw-text-inverse)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
};

const sendButtonDisabled: React.CSSProperties = {
  ...sendButton,
  background: 'rgba(255,255,255,0.08)',
  color:      'var(--tw-text-tertiary)',
  cursor:     'not-allowed',
};

const bottomDock: React.CSSProperties = {
  position:       'fixed',
  left:           '50%',
  bottom:         0,
  transform:      'translateX(-50%)',
  width:          'min(430px, 100%)',
  display:        'flex',
  alignItems:     'flex-end',
  padding:        '0 8px 28px',
  background:     'linear-gradient(to top, var(--tw-paper) 72%, rgba(0,0,0,0))',
  pointerEvents:  'auto',
};

const dockItem: React.CSSProperties = {
  flex:           1,
  padding:        '16px 0 8px',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  border:         'none',
  background:     'transparent',
};

const dockCenter: React.CSSProperties = {
  flex:           1,
  display:        'flex',
  justifyContent: 'center',
  position:       'relative',
};
