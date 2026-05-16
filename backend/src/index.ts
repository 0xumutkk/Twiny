// Load .env by walking up from cwd until we find one. This way the backend
// can be started from either the workspace root or backend/ without losing
// env, and we never depend on import.meta (keeps CommonJS-friendly).
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
(function loadEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) { dotenv.config({ path: candidate }); return; }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
})();

import express from 'express';
import cors from 'cors';
import { orchestrate } from './orchestrator.js';
import { evaluatePolicy, type AgentAction } from './policy/engine.js';
import { prepareClaim, prepareTransfer } from './agents/walletAgent.js';
import { buildGmailOAuthUrl, connectGmailWithCode } from './agents/gmailAgent.js';
import { getAgentStatusReport } from './agents/registry.js';
import { assessClaimRisk } from './agents/riskAgent.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'twiny-backend' });
});

// ── Main agent endpoint (read-only) ───────────────────────────
// Returns voice response + scored opportunities. Does NOT prepare a
// transaction — the frontend must call /api/wallet/prepare-claim after
// the user explicitly selects a campaign.
app.post('/api/agent/run', async (req, res) => {
  try {
    const { transcript, walletAddress, profile } = req.body;

    if (!transcript || !walletAddress) {
      res.status(400).json({ error: 'transcript and walletAddress are required' });
      return;
    }

    const result = await orchestrate({
      transcript,
      walletAddress,
      profile: normalizeProfile(profile),
      source:  'user_command',
    });
    res.json(result);
  } catch (err) {
    console.error('[agent/run]', err);
    res.status(500).json({ error: 'Agent pipeline failed', detail: String(err) });
  }
});

// ── Explicit claim preparation (user-selected campaignId) ─────
app.post('/api/wallet/prepare-claim', async (req, res) => {
  try {
    const { walletAddress, campaignId } = req.body;
    if (!walletAddress || typeof campaignId !== 'number') {
      res.status(400).json({ error: 'walletAddress and numeric campaignId are required' });
      return;
    }

    const prepared = await prepareClaim({
      walletAddress,
      campaignId,
      source: 'user_command',
    });
    res.json(prepared);
  } catch (err) {
    console.error('[wallet/prepare-claim]', err);
    res.status(500).json({ error: 'Prepare failed', detail: String(err) });
  }
});

// ── Explicit native MON transfer preparation ───────────────────
app.post('/api/wallet/prepare-transfer', async (req, res) => {
  try {
    const { walletAddress, recipient, amountMON, network } = req.body;
    if (!walletAddress || !recipient || !amountMON || !network) {
      res.status(400).json({ error: 'walletAddress, recipient, amountMON and network are required' });
      return;
    }

    const prepared = await prepareTransfer({
      walletAddress,
      recipient,
      amountMON,
      network,
      source: 'user_command',
    });
    res.json(prepared);
  } catch (err) {
    console.error('[wallet/prepare-transfer]', err);
    res.status(500).json({ error: 'Prepare transfer failed', detail: String(err) });
  }
});

// ── Gmail OAuth helpers for the local demo ──────────────────────
app.get('/api/gmail/oauth-url', (_req, res) => {
  const url = buildGmailOAuthUrl();
  if (!url) {
    res.status(400).json({
      error: 'GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be configured.',
    });
    return;
  }

  res.json({ url, scope: 'https://www.googleapis.com/auth/gmail.readonly' });
});

app.get('/api/gmail/oauth/callback', async (req, res) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.status(400).send('Missing Google OAuth code.');
      return;
    }

    const result = await connectGmailWithCode(code);
    if (!result.ok) {
      res.status(500).send(`Gmail connection failed: ${result.error}`);
      return;
    }

    res.type('html').send(`
      <main style="font-family: system-ui; max-width: 680px; margin: 48px auto; line-height: 1.5;">
        <h1>Gmail connected</h1>
        <p>Twiny can now read today's Gmail messages in this backend session.</p>
        <p>For a stable demo after restart, add this refresh token to <code>.env</code> as <code>GMAIL_REFRESH_TOKEN</code>:</p>
        <pre style="white-space: pre-wrap; background: #f6f6f6; padding: 16px; border-radius: 8px;">${result.refreshToken}</pre>
      </main>
    `);
  } catch (err) {
    res.status(500).send(`Gmail OAuth callback failed: ${String(err)}`);
  }
});

// ── ElevenLabs STT proxy ──────────────────────────────────────
app.post(
  '/api/stt',
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }),
  async (req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'audio body required' });
        return;
      }

      const audioType = (req.headers['content-type'] as string) ?? 'audio/webm';
      const form = new FormData();
      // ElevenLabs Speech-to-Text expects the audio under the `file` field
      // and a `model_id` (only `scribe_v1` is currently GA).
      form.append('file', new Blob([new Uint8Array(req.body)], { type: audioType }), 'recording.webm');
      form.append('model_id', 'scribe_v1');

      const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method:  'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
        body:    form,
      });

      if (!sttRes.ok) {
        const detail = await sttRes.text();
        res.status(502).json({ error: 'ElevenLabs STT failed', detail });
        return;
      }

      const data = await sttRes.json() as { text?: string };
      res.json({ text: data.text ?? '' });
    } catch (err) {
      console.error('[stt]', err);
      res.status(500).json({ error: 'STT proxy error', detail: String(err) });
    }
  }
);

// ── Agent registry / Permission Dashboard data source ────────
app.get('/api/agents/status', (_req, res) => {
  res.json({
    contractAddress: process.env.CAMPAIGN_CONTRACT_ADDRESS ?? null,
    chainId:         Number(process.env.MONAD_CHAIN_ID ?? 10143),
    agents:          getAgentStatusReport(),
  });
});

// ── Standalone Risk Agent endpoint (simulate + gas estimate) ─
app.post('/api/risk/assess', async (req, res) => {
  try {
    const { walletAddress, contractAddress, campaignId } = req.body;
    if (!walletAddress || !contractAddress || typeof campaignId !== 'number') {
      res.status(400).json({ error: 'walletAddress, contractAddress and numeric campaignId are required' });
      return;
    }
    const assessment = await assessClaimRisk(walletAddress, contractAddress, campaignId);
    res.json(assessment);
  } catch (err) {
    console.error('[risk/assess]', err);
    res.status(500).json({ error: 'Risk assessment failed', detail: String(err) });
  }
});

// ── Policy check endpoint (called before showing Approval Card) ─
app.post('/api/policy/check', (req, res) => {
  try {
    const action: AgentAction = req.body;
    const result = evaluatePolicy(action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'Invalid action', detail: String(err) });
  }
});

// ── ElevenLabs TTS proxy ──────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  try {
    if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
      res.status(500).json({ error: 'ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set' });
      return;
    }

    const { text, language } = req.body;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }

    // Simple heuristic to detect Turkish if not explicitly provided
    const isTurkish = language === 'tr' || text.match(/[çğıöşüÇĞIÖŞÜ]/) || text.match(/\b(ve|bir|bu|da|de|mi|mu|mü|için|ile|merhaba|tamam|evet|hayır)\b/i);
    
    // Use the Turkish Voice ID if Turkish is detected, else fallback to default
    const voiceId = isTurkish ? 'Q5n6GDIjpN0pLOlycRFT' : process.env.ELEVENLABS_VOICE_ID;

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method:  'POST',
        headers: {
          'xi-api-key':    process.env.ELEVENLABS_API_KEY,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          text,
          model_id:         'eleven_multilingual_v2', // Multilingual model for better TR support
          voice_settings:   { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!ttsRes.ok) {
      const detail = await ttsRes.text();
      res.status(502).json({ error: 'ElevenLabs TTS failed', detail });
      return;
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    res.status(500).json({ error: 'TTS proxy error', detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Twiny backend running on http://localhost:${PORT}`);
});

// ── helpers ────────────────────────────────────────────────────
function normalizeProfile(p: any) {
  return {
    interests:     Array.isArray(p?.interests) ? p.interests : [],
    riskTolerance: ['low', 'medium', 'high'].includes(p?.riskTolerance) ? p.riskTolerance : 'low',
    minRewardMON:  typeof p?.minRewardMON === 'number' ? p.minRewardMON : 0.5,
    maxMinutes:    typeof p?.maxMinutes   === 'number' ? p.maxMinutes   : 10,
  };
}
