import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { PremiumApp } from './PremiumApp';
import { UnifiedAdminTourPage } from './UnifiedAdminTourPage';
import './styles/premium.css';
import './styles/commerce-v6.css';
import './styles/v6.css';
import './styles/production-polish.css';
import './styles/admin-unified-tour.css';

declare global {
  interface Window { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; BackButton?:any; MainButton?:any } } }
}

const isProduction = window.location.hostname === 'max-tour.viiversion.com';

if (isProduction) {
  document.documentElement.classList.add('is-max-tour-production');
}

try {
  window.Telegram?.WebApp?.ready?.();
  window.Telegram?.WebApp?.expand?.();
} catch {}

function LiveDemoV28() {
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const src = `https://max-tour-demo.viiversion.com${path}`;
  return (
    <iframe
      title="MAX TOUR — Live Prototype v28"
      src={src}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100dvh',
        border: 0,
        margin: 0,
        padding: 0,
        background: '#ffffff',
      }}
      allow="clipboard-write; fullscreen"
    />
  );
}

function DemoRouterRoot() {
  const location = useLocation();
  const isUnifiedTourEditor = /^\/admin\/tours\/[^/]+\/?$/.test(location.pathname);
  return isUnifiedTourEditor ? <UnifiedAdminTourPage /> : <PremiumApp />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  isProduction
    ? <LiveDemoV28 />
    : <React.StrictMode><BrowserRouter><DemoRouterRoot /></BrowserRouter></React.StrictMode>
);
