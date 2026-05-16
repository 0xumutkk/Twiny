/**
 * Orchestrator (Main Twin)
 *
 * Architecture plan §2.1: receives the transcript, extracts intent and
 * delegates to subagents. Never executes actions, never signs.
 *
 * Every subagent run produces an AgentActivity entry so the frontend can
 * display the chain of work and the user can see exactly which agents
 * contributed to the response.
 */

import { summarizeTodayEmails, type TodayEmailSummary } from './agents/gmailAgent.js';
import { runOpportunityAgent, type UserProfile } from './agents/opportunityAgent.js';
import { runWalletAgent } from './agents/walletAgent.js';
import { runCalendarAgent } from './agents/calendarAgent.js';
import { runSocialAgent } from './agents/socialAgent.js';
import { activity, type AgentActivity } from './agents/registry.js';
import type { SourceType } from './policy/engine.js';

export interface OrchestratorInput {
  transcript:    string;
  walletAddress: string;
  profile:       UserProfile;
  source?:       SourceType;
}

export interface TransferRequest {
  recipient?: string;
  amountMON?: string;
  asset?:     string;
  network?:   string;
}

export type OrchestratorIntent =
  | 'check_wallet'
  | 'find_opportunities'
  | 'check_both'
  | 'summarize_today_email'
  | 'prepare_transfer'
  | 'check_calendar'
  | 'check_social'
  | 'unknown';

export interface OrchestratorOutput {
  intent:           OrchestratorIntent;
  voiceResponse:    string;
  opportunities:    ReturnType<typeof runOpportunityAgent>;
  walletBalance:    string;
  activities:       AgentActivity[];
  mailSummary?:     TodayEmailSummary;
  transferRequest?: TransferRequest;
  error?:           string;
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { transcript, walletAddress, profile, source = 'user_command' } = input;
  const route = classifyTranscript(transcript, profile.riskTolerance);
  const activities: AgentActivity[] = [];

  // ── Gmail summary path ───────────────────────────────────────
  if (route.intent === 'summarize_today_email') {
    const t = Date.now();
    const mailSummary = await summarizeTodayEmails();
    activities.push(activity('mail',
      mailSummary.status === 'ok'
        ? `Read ${mailSummary.totalToday} emails, surfaced ${mailSummary.important.length} important.`
        : mailSummary.status === 'not_configured'
          ? 'Gmail not connected — opened OAuth link.'
          : 'Gmail read failed.',
      { status: mailSummary.status === 'ok' ? 'ok' : 'noop', durationMs: Date.now() - t, detail: mailSummary }
    ));
    return {
      intent:        'summarize_today_email',
      voiceResponse: mailSummary.voiceSummary,
      opportunities: [],
      walletBalance: '',
      activities,
      mailSummary,
    };
  }

  // ── Calendar stub ────────────────────────────────────────────
  if (route.intent === 'check_calendar') {
    const cal = await runCalendarAgent();
    activities.push(activity('calendar', cal.message, { status: 'noop', detail: cal }));
    return {
      intent:        'check_calendar',
      voiceResponse: cal.message,
      opportunities: [],
      walletBalance: '',
      activities,
    };
  }

  // ── Social stub ──────────────────────────────────────────────
  if (route.intent === 'check_social') {
    const soc = await runSocialAgent();
    activities.push(activity('social', soc.message, { status: 'noop', detail: soc }));
    return {
      intent:        'check_social',
      voiceResponse: soc.message,
      opportunities: [],
      walletBalance: '',
      activities,
    };
  }

  // ── Transfer prep path (frontend calls prepare-transfer next) ─
  if (route.intent === 'prepare_transfer') {
    const missing = getMissingTransferFields(route.transfer);
    activities.push(activity('wallet',
      missing.length > 0
        ? `Transfer request parsed — missing: ${missing.join(', ')}.`
        : `Transfer parsed: ${route.transfer?.amountMON} MON to ${shortAddress(route.transfer?.recipient)}.`,
      { status: missing.length > 0 ? 'error' : 'ok', detail: route.transfer }
    ));

    if (missing.length > 0) {
      return {
        intent: 'prepare_transfer',
        voiceResponse: `Transfer için ${missing.join(', ')} bilgisi eksik. Monad testnet üzerinde alıcı 0x adresi ve MON tutarını söyle.`,
        opportunities: [],
        walletBalance: '',
        activities,
        transferRequest: route.transfer,
        error: `Missing transfer fields: ${missing.join(', ')}`,
      };
    }

    return {
      intent:          'prepare_transfer',
      voiceResponse:   `Monad testnet üzerinde ${route.transfer?.amountMON} MON transferini hazırlıyorum. Lütfen ekrandaki onay kartını kontrol et.`,
      opportunities:   [],
      walletBalance:   '',
      activities,
      transferRequest: route.transfer,
    };
  }

  // ── Wallet + Opportunity path ─────────────────────────────────
  const t1 = Date.now();
  const walletResult  = await runWalletAgent(walletAddress);
  activities.push(activity('wallet',
    `Balance: ${parseFloat(walletResult.balance).toFixed(2)} MON. ${walletResult.claimableRewards.length} claimable campaign(s).`,
    { status: 'ok', durationMs: Date.now() - t1 }
  ));

  const t2 = Date.now();
  const opportunities = runOpportunityAgent(
    walletResult.claimableRewards,
    { ...profile, riskTolerance: route.riskFilter },
    walletAddress,
    process.env.CAMPAIGN_CONTRACT_ADDRESS,
    source
  );
  const recommended = opportunities.filter(o => o.recommended).length;
  const blocked     = opportunities.filter(o => o.policyResult.blocked).length;
  activities.push(activity('opportunity',
    `Scored ${opportunities.length}, recommended ${recommended}, blocked ${blocked}.`,
    { status: 'ok', durationMs: Date.now() - t2 }
  ));

  if (blocked > 0) {
    activities.push(activity('policy',
      `Blocked ${blocked} action(s) — see card for reasons.`,
      { status: 'blocked' }
    ));
  }

  return {
    intent:        route.intent,
    voiceResponse: buildVoiceResponse(walletResult.balance, opportunities),
    opportunities,
    walletBalance: walletResult.balance,
    activities,
  };
}

function classifyTranscript(
  transcript: string,
  defaultRisk: UserProfile['riskTolerance']
): {
  intent: Exclude<OrchestratorIntent, 'unknown'>;
  riskFilter: UserProfile['riskTolerance'];
  transfer?: TransferRequest;
} {
  const text = transcript.toLocaleLowerCase('en-US');
  const transfer = parseTransfer(transcript);

  if (
    includesAny(text, ['mail', 'gmail', 'e-posta', 'eposta', 'inbox', 'gelen kutusu']) &&
    includesAny(text, ['özet', 'ozet', 'summary', 'summarize', 'önemli', 'onemli', 'bugün', 'bugun', 'today'])
  ) {
    return { intent: 'summarize_today_email', riskFilter: defaultRisk };
  }

  if (includesAny(text, ['calendar', 'takvim', 'event', 'etkinlik', 'meeting', 'toplantı', 'toplanti'])) {
    return { intent: 'check_calendar', riskFilter: defaultRisk };
  }

  if (includesAny(text, ['social', 'sosyal', 'twitter', 'x post', 'community', 'topluluk', 'discord'])) {
    return { intent: 'check_social', riskFilter: defaultRisk };
  }

  if (transfer && includesAny(text, ['gönder', 'gonder', 'yolla', 'transfer', 'send', 'pay', 'öde', 'ode'])) {
    return { intent: 'prepare_transfer', riskFilter: defaultRisk, transfer };
  }

  const asksWallet = includesAny(text, ['wallet', 'balance', 'bakiye', 'cuzdan', 'cüzdan', 'mon']);
  const asksOpportunities = includesAny(text, [
    'opportunity', 'opportunities', 'campaign', 'campaigns',
    'firsat', 'fırsat', 'odul', 'ödül', 'claim', 'reward',
  ]);

  let intent: Exclude<OrchestratorIntent, 'unknown'> = 'check_both';
  if (asksWallet && !asksOpportunities) intent = 'check_wallet';
  if (!asksWallet && asksOpportunities) intent = 'find_opportunities';

  return { intent, riskFilter: extractRiskFilter(text, defaultRisk) };
}

function parseTransfer(transcript: string): TransferRequest | undefined {
  const recipient = transcript.match(/0x[a-fA-F0-9]{40}/)?.[0];
  const amountMatch = transcript.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:mon|native mon)?\b/i);
  const mentionsUnsupportedNetwork = /\b(ethereum|mainnet|base|optimism|arbitrum|polygon|solana|bitcoin|bsc)\b/i.test(transcript);
  const mentionsMonad = /\b(monad|monad testnet|monad-testnet)\b/i.test(transcript);
  const asset = /\bmon\b/i.test(transcript) ? 'MON' : undefined;

  if (!recipient && !amountMatch && !mentionsMonad) return undefined;

  return {
    recipient,
    amountMON: amountMatch?.[1]?.replace(',', '.'),
    asset,
    network: mentionsUnsupportedNetwork && !mentionsMonad ? 'unsupported' : 'Monad testnet',
  };
}

function getMissingTransferFields(transfer?: TransferRequest): string[] {
  const missing: string[] = [];
  if (!transfer?.recipient) missing.push('alıcı 0x adresi');
  if (!transfer?.amountMON) missing.push('MON tutarı');
  if (!transfer?.network || transfer.network !== 'Monad testnet') missing.push('Monad testnet ağı');
  if (!transfer?.asset || transfer.asset.toUpperCase() !== 'MON') missing.push('native MON asset');
  return missing;
}

function extractRiskFilter(
  text: string,
  defaultRisk: UserProfile['riskTolerance']
): UserProfile['riskTolerance'] {
  if (includesAny(text, ['high risk', 'yuksek risk', 'yüksek risk', 'any risk', 'all risks', 'tum risk', 'tüm risk', 'hepsi'])) return 'high';
  if (includesAny(text, ['medium risk', 'orta risk'])) return 'medium';
  if (includesAny(text, ['low risk', 'dusuk risk', 'düşük risk', 'safe', 'guvenli', 'güvenli'])) return 'low';
  return defaultRisk;
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some(needle => text.includes(needle));
}

function shortAddress(addr?: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'unknown';
}

function buildVoiceResponse(
  balance: string,
  opps: ReturnType<typeof runOpportunityAgent>
): string {
  const recommended = opps.filter(o => o.recommended);
  const blocked     = opps.filter(o => o.policyResult.blocked);

  if (opps.length === 0) {
    return `Cüzdan bakiyen ${parseFloat(balance).toFixed(2)} MON. Şu an için hiçbir kampanya bulamadım.`;
  }

  if (recommended.length === 0 && blocked.length === opps.length) {
    return `Cüzdan bakiyen ${parseFloat(balance).toFixed(2)} MON. ${blocked.length} adet kampanya buldum ancak risk ayarlarını aştığı veya güvenlik kurallarına takıldığı için hepsini engelledim. Detayları ekranda görebilirsin.`;
  }

  // If we have opportunities but none are highly recommended and not all are blocked
  const top = recommended.length > 0 ? recommended[0] : opps.find(o => !o.policyResult.blocked) || opps[0];

  if (recommended.length === 0 && !top.policyResult.blocked) {
     return `Cüzdanında ${parseFloat(balance).toFixed(2)} MON var. Birkaç kampanya buldum ama puanları düşük olduğu için güçlü bir öneri yapamıyorum. Ekranda görebileceğin en iyi seçenek: ${top.campaign.name}. ${top.explanation}`;
  }

  return `Cüzdanında ${parseFloat(balance).toFixed(2)} MON var. En iyi fırsat: ${top.campaign.name}. ${top.explanation} İşlemi hazırlamam için ekrandan seçebilirsin.`;
}
