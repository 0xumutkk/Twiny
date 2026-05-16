'use client';

import { PrivyProvider } from '@privy-io/react-auth';

const monadTestnetRpc = process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC ?? 'https://testnet-rpc.monad.xyz';

// Monad testnet chain config for Privy
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [monadTestnetRpc] },
    public:  { http: [monadTestnetRpc] },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' },
  },
} as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();

  if (!appId || appId.length < 10 || appId.includes('YOUR_') || appId.includes('insert')) {
    return (
      <main style={missingConfigScreen}>
        <section style={missingConfigPanel}>
          <div style={missingConfigMark}>Tw</div>
          <h1 style={missingConfigTitle}>Twiny setup needed</h1>
          <p style={missingConfigText}>Add NEXT_PUBLIC_PRIVY_APP_ID to your frontend environment to enable wallet login.</p>
        </section>
      </main>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Embedded wallet — user never needs to install MetaMask
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain:       monadTestnet,
        supportedChains:    [monadTestnet],
        loginMethods:       ['email', 'wallet', 'google', 'twitter'],
        appearance: {
          theme:       'light',
          accentColor: '#6B5CE7',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

const missingConfigScreen: React.CSSProperties = {
  minHeight:      '100dvh',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  padding:        16,
  background:     '#F7F9F6',
  color:          '#171717',
};

const missingConfigPanel: React.CSSProperties = {
  width:        '100%',
  maxWidth:     390,
  borderRadius: 8,
  background:   '#FFFFFF',
  border:       '1px solid #D9E0D5',
  padding:      22,
  boxShadow:    '0 10px 32px rgba(35, 45, 33, 0.08)',
};

const missingConfigMark: React.CSSProperties = {
  width:          54,
  height:         54,
  borderRadius:   999,
  background:     '#171717',
  color:          '#FFFFFF',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  fontWeight:     900,
};

const missingConfigTitle: React.CSSProperties = {
  margin:     '18px 0 8px',
  fontSize:   24,
  lineHeight: 1.1,
  fontWeight: 900,
};

const missingConfigText: React.CSSProperties = {
  margin:     0,
  color:      '#6B6F66',
  fontSize:   14,
  lineHeight: 1.55,
};
