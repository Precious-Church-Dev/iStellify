'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type InstallEvent = Event & {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const InstallContext = createContext<{
  installed: boolean;
  prompt: InstallEvent | null;
  install: () => Promise<void>;
}>({ installed: false, prompt: null, install: async () => {} });

export default function Pwa({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    const standalone = window.matchMedia('(display-mode: standalone)');
    const detect = () =>
      setInstalled(
        standalone.matches ||
          !!(navigator as Navigator & { standalone?: boolean }).standalone ||
          localStorage.getItem('istelli-pwa-installed') === 'yes',
      );
    const ready = (event: Event) => {
      event.preventDefault();
      setInstalled(false);
      localStorage.removeItem('istelli-pwa-installed');
      setPrompt(event as InstallEvent);
    };
    const complete = () => {
      localStorage.setItem('istelli-pwa-installed', 'yes');
      setInstalled(true);
      setPrompt(null);
    };
    detect();
    standalone.addEventListener('change', detect);
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', complete);
    return () => {
      standalone.removeEventListener('change', detect);
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setPrompt(null);
    try {
      const result = await prompt.prompt();
      if (result?.outcome === 'accepted') {
        localStorage.setItem('istelli-pwa-installed', 'yes');
        setInstalled(true);
      }
    } catch {
      setPrompt(null);
    }
  }

  return (
    <InstallContext.Provider value={{ installed, prompt, install }}>
      {children}
    </InstallContext.Provider>
  );
}

export function InstallControl() {
  const { installed, prompt, install } = useContext(InstallContext);
  return (
    <div className="pwa-install-control">
      <button
        type="button"
        className="button secondary"
        disabled={installed || !prompt}
        onClick={install}
      >
        {installed ? 'Already Installed' : 'Install iStellify'}
      </button>
      {!installed && !prompt && (
        <p className="fine-print">
          To install, look for Install app or Add to Home Screen in your browser menu.
        </p>
      )}
    </div>
  );
}
