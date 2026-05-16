import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { orchestrate } from './orchestrator.js';
import { evaluatePolicy, type AgentAction } from './policy/engine.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'twiny-backend' });
});

// ── Main agent endpoint ───────────────────────────────────────
// Frontend sends transcript + wallet address + user profile.
// Returns voice response text + structured opportunities + prepared action.
app.post('/api/agent/run', async (req, res) => {
  try {
    const { transcript, walletAddress, profile } = req.body;

    if (!transcript || !walletAddress) {
      res.status(400).json({ error: 'transcript and walletAddress are required' });
      return;
    }

    const result = await orchestrate({ transcript, walletAddress, profile });
    res.json(result);
  } catch (err) {
    console.error('[agent/run]', err);
    res.status(500).json({ error: 'Agent pipeline failed', detail: String(err) });
  }
});

// ── ElevenLabs STT proxy (keeps API key server-side) ──────────
app.post('/api/stt', express.raw({ type: ['audio/webm', 'application/octet-stream'], limit: '20mb' }), async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'audio body required' });
      return;
    }

    const formData = new FormData();
    const audioType = req.headers['content-type'] ?? 'audio/webm';
    const audioBytes = Uint8Array.from(req.body);
    formData.append('audio', new Blob([audioBytes.buffer as ArrayBuffer], { type: audioType }), 'recording.webm');
    formData.append('model_id', 'scribe_v2');

    const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
      },
      body: formData,
    });

    if (!sttRes.ok) {
      const detail = await sttRes.text();
      res.status(502).json({ error: 'ElevenLabs STT failed', detail });
      return;
    }

    const data = await sttRes.json();
    res.json({ text: data.text ?? '' });
  } catch (err) {
    res.status(500).json({ error: 'STT proxy error', detail: String(err) });
  }
});

// ── Policy check endpoint (called before showing Approval Card) ─
// Frontend can pre-validate an action before rendering the card.
app.post('/api/policy/check', (req, res) => {
  try {
    const action: AgentAction = req.body;
    const result = evaluatePolicy(action);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'Invalid action', detail: String(err) });
  }
});

// ── ElevenLabs TTS proxy (keeps API key server-side) ──────────
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method:  'POST',
        headers: {
          'xi-api-key':    process.env.ELEVENLABS_API_KEY ?? '',
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          text,
          model_id:         'eleven_flash_v2_5',
          voice_settings:   { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!ttsRes.ok) {
      res.status(502).json({ error: 'ElevenLabs TTS failed' });
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
