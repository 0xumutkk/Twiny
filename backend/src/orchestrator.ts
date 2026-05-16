/**
 * Orchestrator
 *
 * Receives a transcript, uses Anthropic to extract intent,
 * routes to the correct agents, and returns a structured response.
 *
 * Architecture rule: LLM only extracts intent and routes.
 * It does NOT execute any action. Policy Engine is called AFTER.
 */

import Anthropic from '@anthropic-ai/sdk';
import { runWalletAgent } from './agents/walletAgent.js';
import { runOpportunityAgent, type UserProfile } from './agents/opportunityAgent.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface OrchestratorInput {
  transcript:    string;
  walletAddress: string;
  profile:       UserProfile;
}

export interface OrchestratorOutput {
  intent:        string;
  voiceResponse: string;
  opportunities: Awaited<ReturnType<typeof runOpportunityAgent>>;
  walletBalance: string;
  topAction?:    Awaited<ReturnType<typeof runWalletAgent>>['preparedAction'];
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { transcript, walletAddress, profile } = input;

  // ── Step 1: Extract intent via Anthropic ──────────────────────
  // We send ONLY the transcript and a minimal profile summary.
  // Raw mail / wallet / calendar data never goes to the API.
  const intentRes = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: `You are the intent router for Twiny, a local-first digital twin.
Your ONLY job is to classify the user's command and return JSON.
Never execute actions. Never make decisions. Just classify.

Respond ONLY with valid JSON in this exact shape:
{
  "intent": "check_wallet" | "find_opportunities" | "check_both" | "unknown",
  "riskFilter": "low" | "medium" | "high" | "any",
  "campaignId": number | null
}`,
    messages: [{ role: 'user', content: transcript }],
  });

  let intent = 'check_both';
  let riskFilter = profile.riskTolerance;
  let campaignId: number | undefined;

  try {
    const raw = (intentRes.content[0] as any).text ?? '{}';
    const parsed = JSON.parse(raw);
    intent     = parsed.intent     ?? 'check_both';
    riskFilter = parsed.riskFilter ?? profile.riskTolerance;
    campaignId = parsed.campaignId ?? undefined;
  } catch {
    // fallback: treat as check_both
  }

  // ── Step 2: Run agents ────────────────────────────────────────
  const walletResult = await runWalletAgent(walletAddress, campaignId);

  const opportunities = runOpportunityAgent(
    walletResult.claimableRewards,
    { ...profile, riskTolerance: riskFilter as any },
    walletAddress,
    process.env.CAMPAIGN_CONTRACT_ADDRESS
  );

  const topAction = walletResult.preparedAction;

  // ── Step 3: Build voice response ─────────────────────────────
  // This text is sent to ElevenLabs TTS.
  const voiceResponse = buildVoiceResponse(
    walletResult.balance,
    opportunities,
    topAction
  );

  return {
    intent,
    voiceResponse,
    opportunities,
    walletBalance: walletResult.balance,
    topAction,
  };
}

function buildVoiceResponse(
  balance: string,
  opps: Awaited<ReturnType<typeof runOpportunityAgent>>,
  topAction: Awaited<ReturnType<typeof runWalletAgent>>['preparedAction']
): string {
  const recommended = opps.filter(o => o.recommended);
  const blocked     = opps.filter(o => o.policyResult.blocked);

  if (recommended.length === 0 && blocked.length === 0) {
    return `Your wallet balance is ${parseFloat(balance).toFixed(2)} MON. No eligible campaigns found right now.`;
  }

  if (recommended.length === 0 && blocked.length > 0) {
    return `Your wallet balance is ${parseFloat(balance).toFixed(2)} MON. I found ${blocked.length} campaign${blocked.length > 1 ? 's' : ''} but blocked them all — they exceed your risk settings or have policy violations. Check the details on screen.`;
  }

  const top = recommended[0];
  return `Your wallet has ${parseFloat(balance).toFixed(2)} MON. Best opportunity: ${top.campaign.name}. ${top.explanation} I've prepared the approval card — review and approve when ready.`;
}
