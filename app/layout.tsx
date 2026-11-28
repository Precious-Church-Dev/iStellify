import Pwa from '@/components/Pwa';
import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'iStellify · Grow with purpose',
  description: 'Precious Church personal growth and ministry platform',
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: '/assets/icons/App_Icon_Happy_Stelli.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'iStellify' },
};
export const viewport: Viewport = { themeColor: '#13293D' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Pwa>{children}</Pwa>
      </body>
    </html>
  );
}
