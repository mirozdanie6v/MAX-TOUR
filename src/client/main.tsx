import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PremiumApp } from './PremiumApp';
import './styles/premium.css';

declare global {
  interface Window { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; BackButton?:any; MainButton?:any } } }
}

try {
  window.Telegram?.WebApp?.ready?.();
  window.Telegram?.WebApp?.expand?.();
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><PremiumApp/></BrowserRouter></React.StrictMode>
);
