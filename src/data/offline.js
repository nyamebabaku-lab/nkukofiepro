// Connectivity state and the "install app" prompt.
import { useEffect, useState } from 'react';
import { create } from 'zustand';

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export const useInstall = create(() => ({ prompt: null, installed: false }));

let started = false;
export function startOfflineServices() {
  if (started) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null, installed: true }));
  if (window.matchMedia?.('(display-mode: standalone)').matches) useInstall.setState({ installed: true });
  navigator.storage?.persist?.();
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
