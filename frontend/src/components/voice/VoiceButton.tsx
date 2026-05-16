'use client';

import { type VoiceState } from '../../hooks/useVoice';

interface VoiceButtonProps {
  state:          VoiceState;
  transcript?:    string;
  onPress:        () => void;
  onRelease:      () => void;
}

const LABELS: Record<VoiceState, string> = {
  idle:       'Hold to speak',
  recording:  'Listening',
  processing: 'Analysing',
  speaking:   'Speaking',
  error:      'Mic error',
};

const COLORS: Record<VoiceState, string> = {
  idle:       '#4F46E5',
  recording:  '#D64B4B',
  processing: '#C98722',
  speaking:   '#008D69',
  error:      '#D64B4B',
};

const SYMBOLS: Record<VoiceState, string> = {
  idle:       'Mic',
  recording:  'Rec',
  processing: '...',
  speaking:   'Talk',
  error:      'Retry',
};

export function VoiceButton({ state, transcript, onPress, onRelease }: VoiceButtonProps) {
  const color  = COLORS[state];
  const active = state === 'recording';

  return (
    <section style={wrap}>
      <button
        onPointerDown={onPress}
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onPointerLeave={() => {
          if (active) onRelease();
        }}
        aria-label="Push to talk"
        style={{
          ...voicePill,
          background: color,
          boxShadow:  active ? `0 0 0 12px ${color}26` : '0 14px 34px rgba(35, 45, 33, 0.12)',
          transform:  active ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <span style={voiceSymbol}>{SYMBOLS[state]}</span>
        <span style={voiceLabel}>{LABELS[state]}</span>
      </button>

      {transcript && state !== 'idle' && (
        <div style={transcriptPill}>
          &ldquo;{transcript}&rdquo;
        </div>
      )}

      <div style={privacyPill}>
        Local wallet control. Voice uses the backend transcription proxy.
      </div>
    </section>
  );
}

const wrap: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  alignItems:    'center',
  gap:           14,
  width:         '100%',
};

const voicePill: React.CSSProperties = {
  width:          'min(100%, 300px)',
  minHeight:      118,
  borderRadius:   999,
  border:         'none',
  cursor:         'pointer',
  transition:     'box-shadow 0.15s, transform 0.15s, background 0.15s',
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            8,
  color:          '#FFFFFF',
  touchAction:    'none',
  userSelect:     'none',
};

const voiceSymbol: React.CSSProperties = {
  minWidth:      54,
  height:        34,
  borderRadius:  999,
  display:       'flex',
  alignItems:    'center',
  justifyContent:'center',
  background:    'rgba(255,255,255,0.20)',
  fontSize:      12,
  fontWeight:    900,
};

const voiceLabel: React.CSSProperties = {
  fontSize:   20,
  lineHeight: 1.1,
  fontWeight: 900,
};

const transcriptPill: React.CSSProperties = {
  fontSize:     13,
  color:        '#171717',
  background:   '#FFFFFF',
  border:       '1px solid #D9E0D5',
  borderRadius: 999,
  padding:      '10px 16px',
  maxWidth:     340,
  textAlign:    'center',
  lineHeight:   1.45,
  fontWeight:   600,
};

const privacyPill: React.CSSProperties = {
  fontSize:     11,
  color:        '#6B6F66',
  textAlign:    'center',
  lineHeight:   1.45,
  borderRadius: 999,
  padding:      '8px 12px',
  background:   '#EEF5FF',
  maxWidth:     300,
  fontWeight:   700,
};
