// Build the Companies Identified List.docx / .pdf
// Pulls the live production pipeline snapshot and produces a clean,
// printable artefact listing every identified company, its signals,
// their supporting sources and a brief explanation. This is the
// deliverable the Ministry can read on its own, without opening the
// platform.

import fs from 'fs';
import path from 'path';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, HeadingLevel, ExternalHyperlink,
} from 'docx';

const ROOT = 'C:/Users/META/Desktop/New/investuae-signals/delivery';
const BACKEND = 'https://backend-lyart-three-63.vercel.app';

// Brand palette
const NAVY = '0E1E3F';
const GOLD = 'B6925E';
const GOLD_DARK = '8C6B3D';
const LINE = 'D5D3C8';
const INK = '4A4D57';
const INK_LIGHT = '6B6E79';
const SAND = 'F8F6EF';

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

const cell = (text, opts = {}) => {
  const { width, header = false, fill, bold = false, align = AlignmentType.LEFT } = opts;
  const lines = String(text).split('\n');
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header
      ? { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }
      : fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP,
    children: lines.map(l => new Paragraph({
      alignment: align,
      spacing: { after: 0 },
      children: [new TextRun({
        text: l,
        font: 'Calibri',
        size: header ? 18 : 18,
        bold: header || bold,
        color: header ? 'FFFFFF' : '2A2E3A',
      })],
    })),
  });
};

const T = (text, opts = {}) => new TextRun({ text, font: 'Calibri', size: 22, color: '2A2E3A', ...opts });
const P = (children, opts = {}) => new Paragraph({
  spacing: { after: 120, line: 300 },
  alignment: AlignmentType.JUSTIFIED,
  children: Array.isArray(children) ? children : [children],
  ...opts,
});

function LogoImage(widthPx = 240) {
  const buf = fs.readFileSync(path.join(ROOT, 'logo.png'));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const aspect = h / w;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new ImageRun({
      type: 'png', data: buf,
      transformation: { width: widthPx, height: Math.round(widthPx * aspect) },
      altText: { title: 'logo', description: 'Ministry of Investment', name: 'logo' },
    })],
  });
}

function truncate(s, n = 200) {
  if (!s) return '';
  const clean = String(s).replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '\u2026' : clean;
}

function hqLine(hq) {
  if (!hq) return '';
  const parts = [hq.city, hq.country].filter(Boolean);
  return parts.length ? parts.join(', ') : (hq.country_code || '');
}

function sectorLine(sectors) {
  if (!sectors || !sectors.length) return '';
  const nice = {
    'artificial_intelligence': 'AI', 'real_estate': 'Real Estate', 'fintech': 'Fintech',
    'cleantech': 'Cleantech', 'healthcare': 'Healthcare', 'logistics': 'Logistics',
    'ecommerce': 'E-commerce', 'manufacturing': 'Manufacturing', 'energy': 'Energy',
    'tourism': 'Tourism', 'education': 'Education', 'agritech': 'Agritech',
    'space': 'Space', 'defense': 'Defense', 'other': 'Other',
  };
  return sectors.slice(0, 3).map(s => nice[s] || s).join(', ');
}

function strengthLabel(s) {
  return { high: 'High', medium: 'Medium', low: 'Low' }[s] || s;
}

function typeLabel(t) {
  return {
    funding: 'Funding', expansion: 'Expansion', partnership: 'Partnership',
    launch: 'Launch', regulatory: 'Regulatory', hiring: 'Hiring',
    m_and_a: 'M&A', executive: 'Executive',
  }[t] || t;
}

// ─── Fetch live production snapshot ──────────────────────────────
console.log('Fetching live pipeline snapshot...');
// Request the full cached pipeline (capped at 200 by the backend) so
// the tightened quality filter still has enough headroom to produce a
// clean top-25 after rejecting fragments and sanctioned-state captures.
// The min_score=40 cap on the old call was suppressing genuine names
// whose composite scores fall slightly below that bar.
const res = await fetch(`${BACKEND}/api/companies?limit=200&min_score=0`);
if (!res.ok) {
  console.error(`Backend returned ${res.status}`);
  process.exit(1);
}
const data = await res.json();
const companies = data.items ?? [];
console.log(`Received ${companies.length} companies`);

// Stricter quality filter for the deliverable. The entity extractor in the
// backend is tuned for recall so analysts can see the full picture; this
// deliverable is tuned for precision so only names that clearly look like
// real companies reach the Ministry.
//
// This filter mirrors the rules in backend/app/agents/entity_agent.py so
// the companion PDF stays clean even if the live API has not yet been
// redeployed with the tightened backend filter.

const COUNTRY_SINGLE_TOKENS = new Set([
  'iran', 'israel', 'syria', 'russia', 'ukraine', 'yemen',
  'afghanistan', 'turkey', 'libya', 'sudan', 'belarus',
  'cuba', 'venezuela', 'myanmar', 'eritrea', 'somalia',
  'germany', 'france', 'italy', 'spain', 'brazil', 'mexico',
  'canada', 'australia', 'japan', 'indonesia', 'thailand',
  'vietnam', 'philippines', 'malaysia', 'poland', 'netherlands',
  'greece', 'portugal', 'norway', 'sweden', 'finland',
  'denmark', 'ireland', 'austria', 'switzerland', 'belgium',
  'nigeria', 'kenya', 'ethiopia', 'ghana', 'senegal',
]);

const TOPIC_WORDS = new Set([
  'education', 'infrastructure', 'proptech', 'fintech',
  'cleantech', 'healthcare', 'logistics', 'manufacturing',
  'tourism', 'defense', 'defence', 'energy', 'agritech',
  'biotech', 'edtech', 'insurtech', 'regtech', 'mobility',
  'retail', 'ecommerce', 'e-commerce', 'aviation', 'telecom',
  'media', 'gaming', 'adtech', 'martech', 'hrtech',
]);

const GENERIC_PREFIXES = new Set([
  'ai', 'ml', 'nlp', 'iot', 'ar', 'vr', 'dl',
  'saudi', 'uae', 'us', 'uk', 'indian', 'chinese', 'japanese',
  'african', 'european', 'asian', 'arabian', 'gulf', 'mena',
  'american', 'global', 'international', 'regional', 'national',
]);

const PUBLICATION_STARTS = new Set([
  'wired', 'techcrunch', 'reuters', 'bloomberg', 'forbes',
  'cnn', 'bbc', 'guardian', 'economist', 'axios', 'verge',
  'engadget', 'gizmodo', 'wamda', 'magnitt', 'menabytes',
  'sifted', 'crunchbase', 'venturebeat', 'zawya', 'agbi',
  'khaleej', 'gulf', 'arabian', 'skift',
]);

const TRAILING_NOISE = new Set([
  'just', 'only', 'now', 'recently', 'still', 'then',
  'also', 'not', 'major', 'key', 'new', 'top', 'first',
  'and', 'or', 'of', 'for', 'with', 'from', 'to', 'in',
  'on', 'at', 'by', 'the', 'a', 'an',
  // Trailing "other"/"others" means a clause boundary cut off the
  // name mid-list ("Joa Capital and other [investors]").
  'other', 'others',
]);

// Geographic-feature leading tokens. "Strait of Hormuz", "Bay of
// Bengal", "Mount Everest" — not companies.
const GEO_FEATURES = new Set([
  'strait', 'sea', 'bay', 'ocean', 'peninsula', 'cape',
  'mount', 'lake', 'river', 'sound', 'channel', 'island',
  'islands', 'valley', 'desert', 'plateau',
]);

function looksLikeRealCompany(name) {
  if (!name || name.length < 3) return false;
  const trimmed = name.trim();
  // All-lowercase = fragment (real names have Title Case)
  if (trimmed === trimmed.toLowerCase()) return false;
  // Starts with an article or determiner = fragment
  if (/^(?:the|a|an|this|that|these|those|some|new|existing|several|other)\s/i.test(trimmed)) return false;
  // Contains finance-verb noise = fragment
  if (/\b(?:round|funding|investment|raised|raises|series|led\s+by|billion|million|backed|secures?|six[- ]figure|seven[- ]figure)\b/i.test(trimmed)) return false;
  // Contains generic phrases that aren't company names
  if (/\b(?:projects?|market|sector|industry|ecosystem|region|economy)\b/i.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 6) return false;
  // Single-token short names like "UAE", "AI" (two-letter uppercase) are locations/acronyms
  if (words.length === 1 && words[0].length <= 3) return false;
  // First word must start with uppercase
  if (!/^[A-Z]/.test(words[0])) return false;
  // Reject pure location names
  const lowered = trimmed.toLowerCase();
  const locations = [
    'united arab emirates', 'abu dhabi', 'dubai', 'saudi arabia', 'riyadh',
    'qatar', 'doha', 'kuwait', 'bahrain', 'oman', 'egypt', 'jordan',
    'united states', 'united kingdom', 'singapore', 'india', 'china',
  ];
  if (locations.includes(lowered)) return false;
  // Reject single-token country names (Iran, Russia, etc.)
  if (words.length === 1 && COUNTRY_SINGLE_TOKENS.has(lowered)) return false;
  // Reject single-token topic / sector nouns
  if (words.length === 1 && TOPIC_WORDS.has(lowered)) return false;
  // Reject captures that start with a known publication brand
  if (words.length >= 2 && PUBLICATION_STARTS.has(words[0].toLowerCase())) return false;
  // Reject multi-word captures where every token is a generic prefix,
  // topic word, or country — "AI education", "Saudi proptech", "Gulf fintech".
  if (words.length >= 2) {
    const loweredTokens = words.map(w => w.toLowerCase());
    const allGeneric = loweredTokens.every(t =>
      TOPIC_WORDS.has(t) || GENERIC_PREFIXES.has(t) || COUNTRY_SINGLE_TOKENS.has(t)
    );
    if (allGeneric) return false;
  }
  // Reject captures whose trailing token is adverbial / function-word noise
  const lastTok = words[words.length - 1].toLowerCase().replace(/[.,;:]+$/, '');
  if (TRAILING_NOISE.has(lastTok)) return false;
  // Reject captures with clause-boundary prepositions in the middle
  // ("Cyclex in six-figure deal Saudi-Egyptian").
  if (words.length >= 3) {
    const middle = words.slice(1, -1).map(w => w.toLowerCase());
    if (middle.some(t => ['in', 'with', 'for', 'by', 'from', 'at', 'on'].includes(t))) {
      return false;
    }
  }
  // Reject geographic-feature headlines ("Strait of Hormuz", "Bay of
  // Bengal"). These are locations mentioned in news, not companies.
  if (GEO_FEATURES.has(words[0].toLowerCase())) return false;
  // Reject multi-word captures where more than one non-leading token
  // starts lowercase and is not a known glue word. Real English or
  // transliterated Arabic company names use Title Case throughout.
  // Catches foreign-language headline fragments ("Projekti kogu eluea
  // IRR alates esialgsest") that slip through when a feed publishes
  // non-English article titles.
  if (words.length >= 3) {
    const glueWords = new Set(['of', 'and', 'for', 'the', 'a', 'an', 'de', 'la', 'le', 'du', 'el']);
    const lowerStarters = words.slice(1).filter(w => {
      const first = w[0];
      if (!first) return false;
      if (first !== first.toLowerCase() || !/[a-z]/.test(first)) return false;
      return !glueWords.has(w.toLowerCase());
    });
    if (lowerStarters.length >= 2) return false;
  }
  // Reject names containing a topic word if the remaining tokens are
  // too weak to anchor a company identity. "Saudi proptech Jozo" has
  // one strong-ish token ("Jozo") but "proptech" + "saudi" indicate
  // the capture is a sector-header-plus-random-noun, not a company.
  if (words.length >= 2) {
    const loweredTokens = words.map(w => w.toLowerCase());
    const topicHit = loweredTokens.some(t => TOPIC_WORDS.has(t));
    const genericHit = loweredTokens.some(t => GENERIC_PREFIXES.has(t) || COUNTRY_SINGLE_TOKENS.has(t));
    const distinctiveCount = loweredTokens.filter(t =>
      !TOPIC_WORDS.has(t) && !GENERIC_PREFIXES.has(t) &&
      !COUNTRY_SINGLE_TOKENS.has(t) && !['of', 'and', 'for', 'the', 'a', 'an'].includes(t)
    ).length;
    // If the name has a topic word AND a generic prefix/country, it
    // needs at least 2 distinctive tokens OR a corporate-suffix token
    // to be credible. One distinctive token is too easy for random
    // nouns to slip through.
    const corpSuffixes = new Set(['inc', 'ltd', 'llc', 'plc', 'corp', 'ventures', 'capital', 'partners', 'holdings', 'group', 'bank']);
    const hasCorpSuffix = loweredTokens.some(t => corpSuffixes.has(t));
    if (topicHit && genericHit && distinctiveCount < 2 && !hasCorpSuffix) return false;
  }
  return true;
}

const filtered = companies.filter(c => looksLikeRealCompany(c.name));
console.log(`After quality filter: ${filtered.length} companies`);

// Pick top 25 by composite score for a clean deliverable length
const top = filtered
  .map(c => ({ ...c, composite: (c.investability_score + c.uae_alignment_score) / 2 }))
  .sort((a, b) => b.composite - a.composite)
  .slice(0, 25);
console.log(`Top-25 list built`);

// ─── Build the document ──────────────────────────────────────────
const sections = [];

// Cover / title
sections.push(LogoImage(240));
sections.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 120, after: 80 },
  children: [new TextRun({
    text: 'MINISTRY OF INVESTMENT  \u00B7  INVEST UAE',
    font: 'Calibri', size: 18, bold: true, color: GOLD_DARK, characterSpacing: 60,
  })],
}));
sections.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 120, after: 120 },
  children: [new TextRun({
    text: 'Companies Identified',
    font: 'Calibri', size: 44, bold: true, color: NAVY,
  })],
}));
sections.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({
    text: 'Live pipeline snapshot from the InvestUAE Signal Intelligence platform',
    font: 'Calibri', size: 22, italics: true, color: INK,
  })],
}));
sections.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({
    text: `Snapshot generated ${new Date().toISOString().slice(0, 10)} from ${BACKEND}`,
    font: 'Calibri', size: 18, color: INK_LIGHT,
  })],
}));

// Introduction
sections.push(P(T('This document is the companion output to the main InvestUAE Signal Intelligence pilot delivery. It lists the top twenty-five companies currently in the ranked pipeline, selected by composite score across investability and United Arab Emirates alignment. For each company, the table that follows captures the company name, identified sectors, headquarters, expansion intent, the individual signals detected across the rolling ninety-day window with links to their supporting public sources, and a brief explanation of why the company represents a potential investment opportunity.')));

sections.push(P(T('This list regenerates automatically on every pipeline refresh. The version presented here was captured live at the timestamp shown on the cover page. The live ranking, additional filters and per-company dossiers are available on the platform.')));

// Summary table of all 25
sections.push(new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 320, after: 140 },
  children: [new TextRun({ text: 'Top twenty-five companies at a glance', font: 'Calibri', size: 28, bold: true, color: NAVY })],
}));

const summaryRows = [
  new TableRow({
    tableHeader: true,
    children: [
      cell('#', { width: 600, header: true }),
      cell('Company', { width: 2600, header: true }),
      cell('Sector', { width: 2000, header: true }),
      cell('Headquarters', { width: 1800, header: true }),
      cell('Composite', { width: 1200, header: true, align: AlignmentType.CENTER }),
      cell('Signals', { width: 1160, header: true, align: AlignmentType.CENTER }),
    ],
  }),
  ...top.map((c, i) => new TableRow({
    children: [
      cell(String(i + 1), { width: 600, align: AlignmentType.CENTER }),
      cell(c.name, { width: 2600, bold: true }),
      cell(sectorLine(c.sectors), { width: 2000 }),
      cell(hqLine(c.headquarters), { width: 1800 }),
      cell(String(Math.round(c.composite)), { width: 1200, align: AlignmentType.CENTER, fill: i % 2 ? SAND : undefined }),
      cell(String((c.signals || []).length), { width: 1160, align: AlignmentType.CENTER }),
    ],
  })),
];

sections.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [600, 2600, 2000, 1800, 1200, 1160],
  rows: summaryRows,
}));

// Per-company detail — each on its own section
sections.push(new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 400, after: 160 },
  pageBreakBefore: true,
  children: [new TextRun({ text: 'Per-company detail', font: 'Calibri', size: 28, bold: true, color: NAVY })],
}));

sections.push(P(T('Each entry below expands the summary line with the full set of detected signals, their strength tier, the public source that raised the signal, and a brief explanation of why the company is investable. The explanation is generated by the platform\u2019s scoring agent from the company\u2019s signal history, sector fit and geographic alignment.')));

for (let i = 0; i < top.length; i++) {
  const c = top[i];

  // Company header
  sections.push(new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 300, after: 80 },
    keepNext: true,
    children: [new TextRun({
      text: `${i + 1}. ${c.name}`,
      font: 'Calibri', size: 24, bold: true, color: NAVY,
    })],
  }));

  // Score / sector / HQ ribbon as a small inline table
  const inv = Math.round(c.investability_score);
  const ali = Math.round(c.uae_alignment_score);
  const comp = Math.round(c.composite);
  const targets = (c.expansion_targets || []).map(t => hqLine(t)).filter(Boolean).join('; ');

  sections.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 2340, 2340, 2340],
    rows: [
      new TableRow({ children: [
        cell(`Composite: ${comp}`, { width: 2340, bold: true, fill: SAND, align: AlignmentType.CENTER }),
        cell(`Investability: ${inv}`, { width: 2340, fill: SAND, align: AlignmentType.CENTER }),
        cell(`UAE alignment: ${ali}`, { width: 2340, fill: SAND, align: AlignmentType.CENTER }),
        cell(`Signals: ${(c.signals || []).length}`, { width: 2340, fill: SAND, align: AlignmentType.CENTER }),
      ]}),
    ],
  }));

  // Metadata rows
  sections.push(new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({ text: 'Sectors: ', font: 'Calibri', size: 20, bold: true, color: NAVY }),
      new TextRun({ text: sectorLine(c.sectors) || 'unspecified', font: 'Calibri', size: 20, color: INK }),
    ],
  }));
  sections.push(new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: 'Headquarters: ', font: 'Calibri', size: 20, bold: true, color: NAVY }),
      new TextRun({ text: hqLine(c.headquarters) || 'unknown', font: 'Calibri', size: 20, color: INK }),
    ],
  }));
  if (targets) {
    sections.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Declared expansion: ', font: 'Calibri', size: 20, bold: true, color: NAVY }),
        new TextRun({ text: targets, font: 'Calibri', size: 20, color: INK }),
      ],
    }));
  }
  if (c.description) {
    sections.push(new Paragraph({
      spacing: { before: 120, after: 120 },
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({ text: 'Why it matters. ', font: 'Calibri', size: 22, bold: true, color: NAVY }),
        new TextRun({ text: truncate(c.description, 450), font: 'Calibri', size: 22, color: '2A2E3A' }),
      ],
    }));
  }

  // Signals table
  const sigs = (c.signals || []).slice(0, 6);
  if (sigs.length > 0) {
    sections.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({
        text: 'Detected signals',
        font: 'Calibri', size: 20, bold: true, color: GOLD_DARK, characterSpacing: 40,
      })],
    }));

    const sigRows = [
      new TableRow({
        tableHeader: true,
        children: [
          cell('Type', { width: 1400, header: true }),
          cell('Strength', { width: 1200, header: true, align: AlignmentType.CENTER }),
          cell('Headline', { width: 4400, header: true }),
          cell('Source', { width: 2360, header: true }),
        ],
      }),
      ...sigs.map((s, si) => {
        const headline = truncate(s.headline || s.rationale || '', 180);
        const src = s.source?.source_name || 'source';
        const srcUrl = s.source?.url || '';
        return new TableRow({
          children: [
            cell(typeLabel(s.type), { width: 1400, fill: si % 2 ? SAND : undefined }),
            cell(strengthLabel(s.strength), { width: 1200, align: AlignmentType.CENTER, fill: si % 2 ? SAND : undefined }),
            cell(headline, { width: 4400, fill: si % 2 ? SAND : undefined }),
            cell(`${src}\n${truncate(srcUrl, 60)}`, { width: 2360, fill: si % 2 ? SAND : undefined }),
          ],
        });
      }),
    ];

    sections.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1400, 1200, 4400, 2360],
      rows: sigRows,
    }));
  }
}

// Closing
sections.push(new Paragraph({
  pageBreakBefore: true,
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 200, after: 160 },
  children: [new TextRun({ text: 'Sources and methodology', font: 'Calibri', size: 28, bold: true, color: NAVY })],
}));
sections.push(P(T('Every signal above traces back to a public source listed in its Source column. The platform ingests twenty-four feeds spanning MENA business press, global technology media, native Arabic-language publishers, founder interviews and primary financial filings. Classification uses a blend of embedding similarity and keyword pattern matching, scored across investability and United Arab Emirates alignment. The pipeline is ninety-day rolling and refreshes on a daily 06:00 UTC cron.')));
sections.push(P(T('For the full methodology page, the per-company dossier with thesis and recommended next actions, and the live ranking, please visit the platform linked on the cover.')));

// Document
const doc = new Document({
  creator: 'Ahmed Raoofuddin',
  title: 'InvestUAE Companies Identified',
  description: 'Live snapshot of the top-ranked companies in the pipeline.',
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'InvestUAE Signal Intelligence  \u00B7  Companies Identified', font: 'Calibri', size: 18, color: INK_LIGHT }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', font: 'Calibri', size: 18, color: INK_LIGHT }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 18, color: INK_LIGHT }),
            new TextRun({ text: ' of ', font: 'Calibri', size: 18, color: INK_LIGHT }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 18, color: INK_LIGHT }),
          ],
        })],
      }),
    },
    children: sections,
  }],
});

const outDocx = path.join(ROOT, 'Companies_Identified_List.docx');
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outDocx, buf);
console.log(`wrote ${outDocx} (${(buf.length / 1024).toFixed(1)} KB)`);
