import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
}

const base = process.argv[2] || 'http://127.0.0.1:8081';
const paths = [
  '/app/market',
  '/app/orders',
  '/app/order/demo-order-sell-usdc-1',
  '/app/order/demo-order-sell-usdc-1/chat?role=buyer',
  '/app/order/demo-order-sell-usdc-1/proof',
  '/app/swap',
  '/app/swap/new',
  '/app/swap/order/new/demo-swap-usdc-eth-1',
  '/app/selling',
  '/app/profile',
];
const widths = [320, 360, 390];

async function demoSession() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = 'expeer-demo-check@example.com';
  const password = 'ExpeerUi!demo12345';
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname: 'demo-mobile-check', phone: '01000000000' } },
    });
    if (signUp.error) throw signUp.error;
    data = signUp.data;
  }
  if (!data.session) throw new Error('No demo session');
  return { supabaseUrl, supabaseKey, session: data.session };
}

function metrics() {
  const doc = document.scrollingElement || document.documentElement;
  const all = Array.from(document.querySelectorAll('body *'));
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (rect.width === 0 || rect.height === 0 || style.position === 'fixed') continue;
    if (rect.right > vw + 1 || rect.left < -1) {
      offenders.push({
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 100),
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      });
    }
  }
  return {
    href: location.href,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: doc.scrollWidth,
    overflow: Math.max(0, doc.scrollWidth - document.documentElement.clientWidth),
    offenders: offenders.slice(0, 8),
  };
}

const auth = await demoSession();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 320, height: 720 }, ignoreHTTPSErrors: true });
await context.addInitScript(({ supabaseUrl, session }) => {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  window.localStorage.setItem(storageKey, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    expires_in: 60 * 60,
    token_type: 'bearer',
    user: session.user,
  }));
  window.localStorage.setItem('expeer.login.email', session.user.email ?? '');
}, auth);
const page = await context.newPage();

const results = [];
for (const width of widths) {
  await page.setViewportSize({ width, height: 720 });
  for (const path of paths) {
    const url = `${base}${path}`;
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);
    const m = await page.evaluate(metrics);
    results.push({ width, path, status: response?.status(), ...m });
  }
}
console.log(JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.status !== 200 || r.overflow > 0 || r.href.includes('/onboarding/login'));
await browser.close();
if (bad.length) {
  console.error('BAD_RESULTS', JSON.stringify(bad, null, 2));
  process.exit(1);
}
