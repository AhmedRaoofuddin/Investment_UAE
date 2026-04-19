// Render the Mermaid diagrams at diagrams.html to PNG files, one per diagram.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/Users/META/Desktop/New/investuae-signals/delivery/diagrams';
fs.mkdirSync(OUT, { recursive: true });

const names = [
  'd1_agents', 'd2_safety', 'd3_pipeline_sequence', 'd4_component', 'd5_er', 'd6_safety_flow',
  'd7_deployment', 'd8_use_case', 'd9_notification_state', 'd10_data_flow', 'd11_layered_architecture',
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1800, height: 2400 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const fileUrl = 'file:///' + path.join('C:/Users/META/Desktop/New/investuae-signals/delivery/diagrams.html').replaceAll('\\', '/');
  await page.goto(fileUrl);

  // Wait for mermaid to render all blocks
  await page.waitForFunction(() => {
    const pres = document.querySelectorAll('pre.mermaid');
    return Array.from(pres).every(p => p.querySelector('svg'));
  }, null, { timeout: 60000 });
  await page.waitForTimeout(800);

  for (let i = 0; i < names.length; i++) {
    const el = await page.$(`#d${i + 1}`);
    if (!el) { console.log(`d${i + 1} missing`); continue; }
    const out = path.join(OUT, names[i] + '.png');
    await el.screenshot({ path: out, omitBackground: false });
    console.log(`→ ${names[i]}.png`);
  }

  await browser.close();
})();
