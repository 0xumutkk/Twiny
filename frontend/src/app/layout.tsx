import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title:       'Twiny',
  description: 'Your twin lives with you, not in our cloud.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
