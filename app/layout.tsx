import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'iStellify · Grow with purpose',
  description: 'Precious Church personal growth and ministry platform',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
