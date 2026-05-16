'use client';

import { type VoiceState } from '../../hooks/useVoice';
import { Icon, TwinOrb } from '../ui/TwinyPrimitives';

interface VoiceButtonProps {
  state:       VoiceState;
  transcript?: string;
  onPress:     () => void;
  onRelease:   () => void;
  onToggle?:   () => void;
}

const LABELS: Record<VoiceState, string> = {
  idle:       'Tap to speak',
  recording:  'Listening — tap to stop',
  processing: 'Thinking',
  speaking:   'Speaking',
  error:      'Tap to retry',
};

export function VoiceButton({ state, transcript, onPress, onRelease, onToggle }: VoiceButtonProps) {
  const active = state === 'recording';
  const busy = state === 'processing' || state === 'speaking';

  return (
    <section style={wrap}>
      <button
        type="button"
        onClick={onToggle}
        onPointerDown={(e) => {
          // Prevent default to avoid text selection on long press
          e.preventDefault();
        }}
        className="tw-press"
        aria-label="Push to talk"
        style={{
          ...voiceButton,
          borderColor: active ? 'rgba(156, 142, 255, 0.5)' : 'var(--tw-border)',
          background: active ? 'var(--tw-monad-soft)' : 'var(--tw-card)',
        }}
      >
        <TwinOrb size={busy ? 60 : 54} listening={active} thinking={busy} />
        <span style={voiceLabel}>{LABELS[state]}</span>
        <span style={voiceHint}>
          {active ? 'Tap again when done' : 'Voice opens the daily brief'}
        </span>
      </button>

      {active && <Waveform />}

      {transcript && state !== 'idle' && (
        <div style={transcriptBubble} className="tw-serif">
          &ldquo;{transcript}&rdquo;
        </div>
      )}
    </section>
  );
}

function Waveform() {
  return (
    <div style={waveform} aria-hidden="true">
      {[12, 18, 28, 22, 14, 24, 20, 30, 16, 22, 14].map((height, index) => (
        <div
          key={`${height}-${index}`}
          style={{
            width: 3,
            height,
            borderRadius: 2,
            background: 'var(--tw-monad)',
            animation: `tw-wave 0.9s ease-in-out ${index * 0.07}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function DockMicButton({ state, onPress, onRelease, onToggle }: Pick<VoiceButtonProps, 'state' | 'onPress' | 'onRelease' | 'onToggle'>) {
  const active = state === 'recording';
  const busy = state === 'processing' || state === 'speaking';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="tw-press"
      aria-label={active ? 'Stop recording' : 'Start recording'}
      style={{
        ...dockMic,
        boxShadow: active
          ? '0 0 0 12px rgba(156,142,255,0.18)'
          : busy
            ? '0 4px 14px rgba(156,142,255,0.3)'
            : '0 8px 28px rgba(156,142,255,0.55)',
        background: active ? 'var(--tw-danger)' : busy ? 'var(--tw-card-elevated)' : 'var(--tw-monad)',
        animation: busy ? 'tw-pulse-soft 1.6s ease-in-out infinite' : undefined,
      }}
    >
      {active ? (
        <Icon name="x" size={20} color="#FFFFFF" strokeWidth={2.2} />
      ) : busy ? (
        <span style={busySpinner} />
      ) : (
        <Icon name="mic" size={22} color="#FFFFFF" strokeWidth={1.8} />
      )}
    </button>
  );
}

const wrap: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'center',
  gap:           14,
};

const voiceButton: React.CSSProperties = {
  width:          '100%',
  minHeight:      176,
  borderRadius:   'var(--tw-r-xl)',
  border:         '0.5px solid var(--tw-border)',
  color:          'var(--tw-text)',
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            12,
  padding:        22,
  touchAction:    'none',
};

const voiceLabel: React.CSSProperties = {
  fontSize:   17,
  lineHeight: 1,
  fontWeight: 600,
};

const voiceHint: React.CSSProperties = {
  color:    'var(--tw-text-tertiary)',
  fontSize: 12,
};

const waveform: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        4,
  height:     32,
};

const transcriptBubble: React.CSSProperties = {
  color:      'var(--tw-text)',
  fontSize:   22,
  lineHeight: 1.25,
  textAlign:  'center',
  padding:    '6px 18px 0',
};

const dockMic: React.CSSProperties = {
  width:          58,
  height:         58,
  borderRadius:   29,
  background:     'var(--tw-monad)',
  border:         '4px solid var(--tw-paper)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  color:          '#FFFFFF',
  cursor:         'pointer',
  touchAction:    'none',
  transition:     'background 0.2s ease, box-shadow 0.2s ease',
};

const busySpinner: React.CSSProperties = {
  width:          16,
  height:         16,
  borderRadius:   8,
  border:         '2px solid rgba(255,255,255,0.25)',
  borderTopColor: '#FFFFFF',
  animation:      'tw-spin 0.8s linear infinite',
};
