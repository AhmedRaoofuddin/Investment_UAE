// Batch-capture production screenshots for the Ministry delivery document.
// Captures: marketing + platform (EN), authenticated workspace (EN),
// select Arabic RTL pages, sign-in and sign-up forms.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/Users/META/Desktop/New/investuae-signals/delivery/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'https://frontend-iota-seven-30.vercel.app';
const EMAIL = 'devzalinos@gmail.com';
const PASSWORD = 'InvestUAE2026!';

// English marketing + platform
const EN_PUBLIC = [
  { name: '01_home_en',          path: '/' },
  { name: '02_signals_en',       path: '/platform/signals' },
  { name: '03_companies_en',     path: '/platform/companies' },
  { name: '04_geo_en',           path: '/platform/geo' },
  { name: '05_sectors_en',       path: '/platform/sectors' },
  { name: '06_why_invest_en',    path: '/why-invest' },
  { name: '07_reports_en',       path: '/reports' },
];

const AUTH_FORMS = [
  { name: '08_signin',           path: '/auth/signin' },
  { name: '09_signup',           path: '/auth/signup' },
];

// Authenticated workspace (same session)
const EN_WORKSPACE = [
  { name: '10_workspace_pulse_en',         path: '/workspace' },
  { name: '11_workspace_overview_en',      path: '/workspace/overview' },
  { name: '12_workspace_dashboard_en',     path: '/workspace/dashboard' },
  { name: '13_workspace_connections_en',   path: '/workspace/connections' },
  { name: '14_workspace_watchlist_en',     path: '/workspace/watchlist' },
  { name: '15_workspace_notifications_en', path: '/workspace/notifications' },
];

// Arabic RTL (public marketing + platform — workspace picks up lang from cookie)
const AR_PUBLIC = [
  { name: '16_home_ar',          path: '/' },
  { name: '17_signals_ar',       path: '/platform/signals' },
  { name: '18_companies_ar',     path: '/platform/companies' },
  { name: '19_geo_ar',           path: '/platform/geo' },
  { name: '20_why_invest_ar',    path: '/why-invest' },
];

const AR_WORKSPACE = [
  { name: '21_workspace_pulse_ar',   path: '/workspace' },
  { name: '22_workspace_dashboard_ar', path: '/workspace/dashboard' },
];

async function grab(page, p) {
  const url = BASE + p.path;
  console.log(`  ${url}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  }
  await page.waitForTimeout(2500);
  const file = path.join(OUT, `${p.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  → ${p.name}.png`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Skip re-capturing what we already have on disk
  const exists = (n) => fs.existsSync(path.join(OUT, `${n}.png`));

  console.log('— EN public —');
  for (const p of EN_PUBLIC) if (!exists(p.name)) await grab(page, p); else console.log(`  skip ${p.name} (exists)`);

  console.log('— Auth forms —');
  for (const p of AUTH_FORMS) if (!exists(p.name)) await grab(page, p); else console.log(`  skip ${p.name} (exists)`);

  // Sign in once and reuse session for workspace
  console.log('— Signing in —');
  await page.goto(BASE + '/auth/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[name="email"]', { timeout: 30000 });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/workspace/, { timeout: 30000 }).catch(() => {
    console.log('  (did not land on /workspace, continuing anyway)');
  });
  await page.waitForTimeout(3000);
  console.log('  signed in');

  console.log('— EN workspace —');
  for (const p of EN_WORKSPACE) await grab(page, p);

  // Toggle to Arabic via the UI toggle button (LocaleProvider persists to
  // localStorage + document attributes, and a UI click flows through the
  // React setState so the whole tree re-renders)
  console.log('— Switching to Arabic —');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // Click the "عربي" button in the header utility strip
  const arBtn = await page.$('button:has-text("عربي")');
  if (arBtn) {
    await arBtn.click();
    console.log('  clicked عربي toggle');
  } else {
    console.log('  fallback: setting localStorage + cookie + reload');
    await page.evaluate(() => {
      try { localStorage.setItem('locale', 'ar'); } catch {}
      document.cookie = 'locale=ar; path=/; max-age=31536000';
    });
    await page.reload({ waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(1500);
  // Sanity check: html[dir] should be rtl now
  const dir = await page.getAttribute('html', 'dir');
  console.log(`  html[dir] = ${dir}`);

  console.log('— AR public —');
  for (const p of AR_PUBLIC) await grab(page, p);

  console.log('— AR workspace —');
  for (const p of AR_WORKSPACE) await grab(page, p);

  await browser.close();
  console.log('\ndone');
})();
