import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import './index.css';
import { MODE } from './config';
import { startOfflineServices } from './data/offline';
import { isNative, startNative } from './data/native';

if (!isNative()) startOfflineServices();
startNative();

// Each build only contains its own app (the other branches are removed at build time).
const load = import.meta.env.VITE_APP === 'admin' ? () => import('./apps/AdminApp') : import.meta.env.VITE_APP === 'main' ? () => import('./apps/MainApp') : () => import('./apps/DemoApp');
document.title = MODE === 'admin' ? 'PoultryPro Admin' : MODE === 'main' ? 'PoultryPro' : 'PoultryPro — Demo';

load().then(({ default: App }) =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
