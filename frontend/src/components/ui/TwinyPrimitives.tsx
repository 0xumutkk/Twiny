import type { CSSProperties } from 'react';

export type IconName =
  | 'arrow-right'
  | 'chevron-left'
  | 'check'
  | 'clock'
  | 'coin'
  | 'home'
  | 'inbox'
  | 'lock'
  | 'mail'
  | 'mic'
  | 'settings'
  | 'shield'
  | 'spark'
  | 'wallet'
  | 'x';

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.5 }: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const s: CSSProperties = { width: size, height: size, display: 'block', flexShrink: 0 };
  const p = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  switch (name) {
    case 'mail':
      return <svg style={s} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" {...p}/><path d="M3 7l9 7 9-7" {...p}/></svg>;
    case 'wallet':
      return <svg style={s} viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 010-4h12" {...p}/><circle cx="17" cy="13" r="1.3" fill={color}/></svg>;
    case 'spark':
      return <svg style={s} viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" {...p}/></svg>;
    case 'shield':
      return <svg style={s} viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" {...p}/></svg>;
    case 'mic':
      return <svg style={s} viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" {...p}/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" {...p}/></svg>;
    case 'lock':
      return <svg style={s} viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" {...p}/><path d="M8 11V8a4 4 0 018 0v3" {...p}/></svg>;
    case 'chevron-left':
      return <svg style={s} viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" {...p}/></svg>;
    case 'x':
      return <svg style={s} viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" {...p}/></svg>;
    case 'check':
      return <svg style={s} viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" {...p}/></svg>;
    case 'home':
      return <svg style={s} viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z" {...p}/></svg>;
    case 'inbox':
      return <svg style={s} viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" {...p}/><path d="M3 13h5a2 2 0 014 0h0a2 2 0 014 0h5" {...p}/></svg>;
    case 'settings':
      return <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" {...p}/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" {...p}/></svg>;
    case 'arrow-right':
      return <svg style={s} viewBox="0 0 24 24"><path d="M4 12h16M14 6l6 6-6 6" {...p}/></svg>;
    case 'clock':
      return <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...p}/><path d="M12 7v5l3 2" {...p}/></svg>;
    case 'coin':
      return <svg style={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...p}/><path d="M12 7v10M9.5 9.5h4.5a1.5 1.5 0 010 3h-4a1.5 1.5 0 000 3h4.5" {...p}/></svg>;
    default:
      return null;
  }
}

export function TwinOrb({ size = 40, listening = false, thinking = false, style }: {
  size?: number;
  listening?: boolean;
  thinking?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      {listening && [0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px solid var(--tw-monad)',
            animation: `tw-ring 1.8s ease-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
      <div
        className="tw-orb"
        style={{
          width: size,
          height: size,
          animation: thinking ? 'tw-pulse-soft 1.6s ease-in-out infinite' : undefined,
        }}
      />
    </div>
  );
}

export function Presence({ tone = 'alive' }: { tone?: 'alive' | 'warn' | 'settled' | 'resting' }) {
  const color = {
    alive: 'var(--tw-monad)',
    warn: 'var(--tw-warn)',
    settled: 'var(--tw-ok)',
    resting: 'var(--tw-text-tertiary)',
  }[tone];

  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: 4,
        background: color,
        animation: tone === 'resting' ? 'none' : 'tw-breathe 2.6s ease-in-out infinite',
      }}
    />
  );
}

export function AgentDot({ agent, size = 8 }: { agent: 'mail' | 'wallet' | 'opportunity' | 'risk' | 'calendar' | 'social' | 'policy'; size?: number }) {
  const color = {
    mail: '#7aa0ff',
    wallet: '#b8aeff',
    opportunity: '#ff9472',
    risk: '#ffb948',
    calendar: '#5bd68b',
    social: '#d69ae0',
    policy: '#e5e5e7',
  }[agent];

  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: size / 2, background: color, flexShrink: 0 }} />;
}

export function RiskBadge({ level = 'low', size = 'sm' }: { level?: 'low' | 'medium' | 'high'; size?: 'sm' | 'md' }) {
  const map = {
    low: { label: 'Low risk', bg: 'var(--tw-ok-soft)', fg: 'var(--tw-ok)' },
    medium: { label: 'Medium risk', bg: 'var(--tw-warn-soft)', fg: 'var(--tw-warn)' },
    high: { label: 'High risk', bg: 'var(--tw-danger-soft)', fg: 'var(--tw-danger)' },
  };
  const risk = map[level];
  const isMedium = size === 'md';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isMedium ? '4px 10px' : '3px 8px',
        borderRadius: 999,
        background: risk.bg,
        color: risk.fg,
        fontSize: isMedium ? 12 : 11,
        fontWeight: 500,
        lineHeight: 1.2,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: risk.fg, display: 'inline-block' }} />
      {risk.label}
    </span>
  );
}
