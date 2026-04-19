// Rewrite backend/data/sources.yaml keeping only the 37 sources that
// passed both the feed-reachability test and the sample-article test
// from an end-user location (Windows, Chrome UA, 12s timeout).
//
// Sources rejected: feed fails, feed empty, or article URLs fail to
// load. We will not ship any source whose article URLs produce an
// ERR_CONNECTION_RESET for the Ministry analyst who clicks through.

import fs from 'fs';
import yaml from 'js-yaml';

const SRC = 'C:/Users/META/Desktop/New/investuae-signals/backend/data/sources.yaml';
const AUDIT = 'C:/Users/META/Desktop/New/investuae-signals/delivery/source_audit.json';

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const rejectUrls = new Set(audit.filter(a => a.verdict === 'REJECT').map(a => a.url));

console.log(`Pruning ${rejectUrls.size} sources`);

const doc = yaml.load(fs.readFileSync(SRC, 'utf8'));
const out = {};
let kept = 0, dropped = 0;

// Preserve section order
for (const [section, feeds] of Object.entries(doc)) {
  if (!Array.isArray(feeds)) { out[section] = feeds; continue; }
  const filtered = feeds.filter(f => {
    if (rejectUrls.has(f.url)) { dropped += 1; return false; }
    kept += 1;
    return true;
  });
  if (filtered.length > 0) out[section] = filtered;
}

// Add audit footer comment
const header = `# ──────────────────────────────────────────────────────────────────────────
# RSS / Atom feed sources for investment-signal scanning.
#
# Every feed listed here was probed end-to-end from a user-location browser:
# feed URL responds 200, feed parses, and sample article URLs resolve.
# Sources that failed reachability were removed to protect the integrity
# of signal-card source links surfaced to analysts.
#
# Curated for MENA region + global expansion candidates. Weight drives
# the scoring bias; tags are informational for filtering downstream.
# ──────────────────────────────────────────────────────────────────────────

`;

const yamlOut = header + yaml.dump(out, { lineWidth: 200, noRefs: true });
fs.writeFileSync(SRC, yamlOut);
console.log(`Kept ${kept} sources, dropped ${dropped}`);
console.log(`Sections retained: ${Object.keys(out).join(', ')}`);
