import Pwa from '@/components/Pwa';
import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'iStellify · Grow with purpose',
  description: 'Precious Church personal growth and ministry platform',
  manifest:'/site.webmanifest',
  icons:{icon:[{url:'/favicon.ico'},{url:'/favicon-32x32.png',sizes:'32x32',type:'image/png'},{url:'/icon.svg',type:'image/svg+xml'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180'}]},
  appleWebApp:{capable:true,statusBarStyle:'default',title:'iStellify'},
};
export const viewport:Viewport={themeColor:'#13293D'};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<Pwa/></body>
    </html>
  );
}
