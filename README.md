# Twiny — Developer Setup Guide

## What you need to do (in order)

---

## Step 1 — Get your API keys (before touching any code)

### Anthropic
1. Go to https://console.anthropic.com
2. Create an account and add a payment method
3. Copy your API key → `ANTHROPIC_API_KEY`

### ElevenLabs
1. Go to https://elevenlabs.io and create an account
2. Go to Profile → API Keys → copy your key → `ELEVENLABS_API_KEY`
3. Go to Voices → pick a voice → copy its Voice ID → `ELEVENLABS_VOICE_ID`
4. The frontend does not need an ElevenLabs key; STT and TTS are proxied by the backend so the API key stays server-side.

### Privy
1. Go to https://dashboard.privy.io
2. Create a new app
3. Copy App ID → `NEXT_PUBLIC_PRIVY_APP_ID`
4. Go to Settings → API Keys → copy App Secret → `PRIVY_APP_SECRET`

---

## Step 2 — Install Foundry (for smart contract deploy)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify: `forge --version`

---

## Step 3 — Get a Monad testnet wallet + MON

1. Install MetaMask if you don't have it
2. Go to https://docs.monad.xyz/guides/add-monad-to-wallet
   - Network name: Monad Testnet
   - RPC: https://testnet-rpc.monad.xyz
   - Chain ID: 10143
   - Symbol: MON
3. Export your private key from MetaMask → `DEPLOYER_PRIVATE_KEY`
   (Settings → Security → Export Private Key)
4. Get free testnet MON from the faucet:
   https://docs.monad.xyz/developer-essentials/testnets
   You need at least 15 MON to deploy + fund the demo campaign.

---

## Step 4 — Clone and configure

```bash
git clone <your-repo>
cd twiny

# Copy env file
cp .env.example .env

# Fill in ALL values in .env
nano .env
```

---

## Step 5 — Deploy the smart contract

```bash
cd contracts

# Install Foundry dependencies
forge install foundry-rs/forge-std

# Build
forge build

# Deploy to Monad testnet
# This deploys TwinyCampaign.sol and seeds one demo campaign
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

After deploy you will see:
```
TwinyCampaign deployed at: 0xYOUR_CONTRACT_ADDRESS
Demo campaign registered. Campaign ID: 1
```

Copy `0xYOUR_CONTRACT_ADDRESS` → paste into `.env` as `CAMPAIGN_CONTRACT_ADDRESS`
Also paste it into `frontend/.env.local` as `NEXT_PUBLIC_CONTRACT_ADDRESS`

> Verify your contract on the explorer so hackathon judges can read the source:
> https://testnet.monadvision.com

---

## Step 6 — Install Monskills (optional but recommended)

Monskills gives Claude Code / Cursor AI-assisted Monad scaffolding.

```bash
# For Claude Code
npx skills add therealharpaljadeja/monskills

# For Cursor: Settings → Plugins → Add → therealharpaljadeja/monskills
```

Use it by telling your AI assistant:
> "Read skills.devnads.com and help me extend TwinyCampaign.sol"

---

## Step 7 — Install and run the backend

```bash
cd backend
npm install
npm run dev
```

Backend runs at http://localhost:3001
Test it: `curl http://localhost:3001/health`

---

## Step 8 — Install and run the frontend

```bash
cd frontend

# Create frontend env file
cp ../.env.example .env.local
# Then fill in NEXT_PUBLIC_* values only

npm install
npm run dev
```

Frontend runs at http://localhost:3000

---

## Step 9 — Test the demo flow

1. Open http://localhost:3000
2. Click "Connect Wallet" — Privy creates an embedded wallet for you
3. Hold the mic button and say:
   > "Check my wallet. Is there anything I should act on today? Low risk only."
4. Watch the Approval Card appear with the Monad Wallet Beta campaign
5. Click Approve → Privy signing screen opens → confirm → TX sent to Monad testnet
6. Explorer link appears in the card

### Test the rejection path
Say: "Show me all campaigns" — the third campaign (High Risk Demo) will appear with
the Approve button disabled and a block reason explaining why Twiny blocked it.

---

## Project structure

```
twiny/
├── contracts/
│   ├── src/TwinyCampaign.sol        ← The smart contract
│   └── script/Deploy.s.sol          ← Deploy script
│
├── backend/
│   └── src/
│       ├── index.ts                 ← Express API server
│       ├── orchestrator.ts          ← Anthropic routing layer
│       ├── policy/engine.ts         ← Deterministic rule engine (no LLM)
│       └── agents/
│           ├── walletAgent.ts       ← Reads balance + prepares claim TX
│           └── opportunityAgent.ts  ← Scores and ranks campaigns
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx             ← Main UI
        │   ├── layout.tsx           ← App shell
        │   └── providers.tsx        ← Privy config
        ├── components/
        │   ├── approval/ApprovalCard.tsx  ← The core trust UX
        │   └── voice/VoiceButton.tsx      ← Mic interface
        └── hooks/useVoice.ts        ← ElevenLabs STT + TTS
```

---

## Common problems

| Problem | Fix |
|---------|-----|
| `forge: command not found` | Run `foundryup` again, restart terminal |
| `DEPLOYER_PRIVATE_KEY` missing | Export from MetaMask → Settings → Security |
| Not enough MON for deploy | Get more from faucet; need ~15 MON minimum |
| Privy login doesn't work | Check `NEXT_PUBLIC_PRIVY_APP_ID` in frontend `.env.local` |
| Voice not transcribing | Check `ELEVENLABS_API_KEY` in backend; allow mic in browser |
| Backend 500 errors | Check `ANTHROPIC_API_KEY` is set and has credits |
| Contract not found | Paste contract address into both `.env` files after deploy |

---

## What is NOT implemented yet (post-MVP)

- Real Gmail connector (mock data is used for demo)
- Calendar Agent
- Social Agent
- On-device encryption of the Local Memory Vault
- On-device Whisper STT (currently using ElevenLabs cloud)
- Local LLM option

These are noted in the architecture plan as Phase 2/3 items.
