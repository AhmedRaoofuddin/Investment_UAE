// Exhaustive source audit. For every feed in sources.yaml:
//   1. Fetch the feed URL. Record HTTP status.
//   2. If feed parses, extract the first 2 article URLs.
//   3. Fetch each article URL. Record status.
//   4. Mark a source as KEEP only if feed AND sample articles resolve.
//
// Runs from the user's local machine so the audit matches what a real
// visitor experiences. If a feed works from Vercel but blocks our region,
// it still produces unreachable source cards for analysts in this region.
// The integrity of the deliverable requires every linked source to open.

import fs from 'fs';
import yaml from 'js-yaml';
import Parser from 'rss-parser';

const SRC = 'C:/Users/META/Desktop/New/investuae-signals/backend/data/sources.yaml';
const raw = fs.readFileSync(SRC, 'utf8');
const doc = yaml.load(raw);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function statusOf(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: '*/*' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, err: e.message.slice(0, 60) };
  }
}

const parser = new Parser({ timeout: 12000, headers: { 'User-Agent': UA } });

const results = [];

for (const [section, feeds] of Object.entries(doc)) {
  if (!Array.isArray(feeds)) continue;
  for (const f of feeds) {
    process.stdout.write(`${f.name.padEnd(40).slice(0,40)}  `);
    const feed = await statusOf(f.url);
    if (!feed.ok) {
      console.log(`FEED=${feed.status}${feed.err ? ' ' + feed.err : ''}  REJECT`);
      results.push({ section, name: f.name, url: f.url, feedStatus: feed.status, sampleStatus: null, verdict: 'REJECT' });
      continue;
    }
    // Try to parse and sample 2 article URLs
    let sampleOk = false, sampleInfo = '';
    try {
      const parsed = await parser.parseURL(f.url);
      const links = (parsed.items || []).map(i => i.link).filter(Boolean).slice(0, 2);
      if (!links.length) {
        sampleInfo = 'no-items';
      } else {
        let oks = 0;
        for (const L of links) {
          const s = await statusOf(L, 10000);
          if (s.ok) oks += 1;
        }
        sampleInfo = `${oks}/${links.length}`;
        sampleOk = oks > 0;
      }
    } catch (e) {
      sampleInfo = 'parse-fail: ' + e.message.slice(0, 40);
    }
    const verdict = sampleOk ? 'KEEP' : 'REJECT';
    console.log(`FEED=${feed.status} ARTICLES=${sampleInfo}  ${verdict}`);
    results.push({ section, name: f.name, url: f.url, feedStatus: feed.status, sampleStatus: sampleInfo, verdict });
  }
}

console.log('\n================ SUMMARY ================');
const kept = results.filter(r => r.verdict === 'KEEP');
const rejected = results.filter(r => r.verdict === 'REJECT');
console.log(`Total: ${results.length}  Keep: ${kept.length}  Reject: ${rejected.length}`);
console.log('\nRejected:');
for (const r of rejected) {
  console.log(`  [${r.section}] ${r.name}  feed=${r.feedStatus}  articles=${r.sampleStatus ?? '-'}`);
}

fs.writeFileSync('C:/Users/META/Desktop/New/investuae-signals/delivery/source_audit.json', JSON.stringify(results, null, 2));
console.log('\nWrote source_audit.json');
