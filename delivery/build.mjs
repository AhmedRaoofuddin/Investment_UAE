// Build the Ministry of Investment delivery document (revision 2).
// Deep technical depth, diagrams, foreword moved forward, natural flow
// without forced page breaks, house style with no em dashes.
import fs from 'fs';
import path from 'path';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat, ExternalHyperlink,
  InternalHyperlink, Bookmark,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak, TabStopType, TabStopPosition,
} from 'docx';

const ROOT = 'C:/Users/META/Desktop/New/investuae-signals/delivery';
const SHOTS = path.join(ROOT, 'screenshots');
const DIAGS = path.join(ROOT, 'diagrams');

// ─── Brand palette ─────────────────────────────────────────────────
const NAVY = '0E1E3F';
const NAVY_DARK = '08152C';
const GOLD = 'B6925E';
const GOLD_DARK = '8C6B3D';
const LINE = 'D5D3C8';
const INK = '4A4D57';
const INK_LIGHT = '6B6E79';
const SAND_BG = 'F8F6EF';

// ─── Anchors for internal TOC links ────────────────────────────────
const H1_ANCHORS = {};
function makeAnchor(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

// ─── Primitives ────────────────────────────────────────────────────
const T = (text, opts = {}) => new TextRun({
  text, font: 'Cambria', size: 22, color: '2A2E3A', ...opts,
});

const P = (children, opts = {}) => new Paragraph({
  spacing: { after: 120, line: 300 },
  alignment: AlignmentType.JUSTIFIED,
  children: Array.isArray(children) ? children : [children],
  ...opts,
});

// Regular H1 (no forced page break). Bookmarks the heading for TOC links.
function H1(text, { pageBreak = false } = {}) {
  const anchor = makeAnchor(text);
  H1_ANCHORS[text] = anchor;
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    pageBreakBefore: pageBreak,
    keepNext: true,
    children: [
      new Bookmark({
        id: anchor,
        children: [new TextRun({ text, font: 'Cambria', size: 36, bold: true, color: NAVY })],
      }),
    ],
  });
}

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 260, after: 120 },
  keepNext: true,
  children: [new TextRun({ text, font: 'Cambria', size: 26, bold: true, color: NAVY })],
});

const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 80 },
  keepNext: true,
  children: [new TextRun({ text, font: 'Cambria', size: 22, bold: true, color: NAVY_DARK })],
});

const Eyebrow = (text) => new Paragraph({
  spacing: { before: 100, after: 60 },
  children: [new TextRun({
    text: text.toUpperCase(),
    font: 'Cambria', size: 18, bold: true, color: GOLD_DARK, characterSpacing: 40,
  })],
});

const Divider = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 1 } },
  spacing: { before: 80, after: 80 },
});

const Caption = (text) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 200 },
  children: [new TextRun({ text, font: 'Cambria', size: 18, italics: true, color: INK_LIGHT })],
});

// Image helper (keeps aspect ratio, centered)
function Img(dir, file, widthPx = 560, heightPx) {
  const buf = fs.readFileSync(path.join(dir, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const aspect = h / w;
  const width = widthPx;
  const height = heightPx || Math.round(width * aspect);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [new ImageRun({
      type: 'png', data: buf,
      transformation: { width, height },
      altText: { title: file, description: file, name: file },
    })],
  });
}

const Screenshot = (f, w = 560) => Img(SHOTS, f, w);
const Diagram = (f, w = 600) => Img(DIAGS, f, w);

function LogoImage(widthPx = 280) {
  const buf = fs.readFileSync(path.join(ROOT, 'logo.png'));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const aspect = h / w;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new ImageRun({
      type: 'png', data: buf,
      transformation: { width: widthPx, height: Math.round(widthPx * aspect) },
      altText: { title: 'Ministry of Investment', description: 'Ministry of Investment and Invest UAE', name: 'logo' },
    })],
  });
}

// ─── Table helpers ─────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, { width, header = false, fill, bold = false, align = AlignmentType.LEFT } = {}) {
  const lines = String(text).split('\n');
  const paragraphs = lines.map(line => new Paragraph({
    alignment: align,
    spacing: { after: 0 },
    children: [new TextRun({
      text: line,
      font: 'Cambria',
      size: header ? 20 : 20,
      bold: header || bold,
      color: header ? 'FFFFFF' : '2A2E3A',
    })],
  }));
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header
      ? { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' }
      : fill
      ? { fill, type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: paragraphs,
  });
}

function buildTable(columnWidths, headerRow, dataRows, { stripe = true } = {}) {
  const total = columnWidths.reduce((a, b) => a + b, 0);
  const rows = [
    new TableRow({
      tableHeader: true,
      children: headerRow.map((h, i) => cell(h, { width: columnWidths[i], header: true })),
    }),
    ...dataRows.map((r, ri) => new TableRow({
      children: r.map((c, i) => cell(c, {
        width: columnWidths[i],
        fill: stripe && ri % 2 === 1 ? SAND_BG : undefined,
      })),
    })),
  ];
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

// ─── Cover page ────────────────────────────────────────────────────
const cover = [
  new Paragraph({ spacing: { before: 1600 }, children: [] }),
  LogoImage(300),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 80 },
    children: [new TextRun({
      text: 'MINISTRY OF INVESTMENT  \u00B7  INVEST UAE',
      font: 'Cambria', size: 20, bold: true, color: GOLD_DARK, characterSpacing: 60,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({
      text: 'InvestUAE Signal Intelligence',
      font: 'Cambria', size: 52, bold: true, color: NAVY,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({
      text: 'An AI-Powered Investment Signal Detection Platform',
      font: 'Cambria', size: 26, color: NAVY_DARK,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({
      text: 'Pilot Delivery Document',
      font: 'Cambria', size: 22, italics: true, color: INK,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 60 },
    children: [new TextRun({
      text: 'Response to the Ministry of Investment AI Case Study',
      font: 'Cambria', size: 20, color: INK_LIGHT,
    })],
  }),
  new Paragraph({ spacing: { before: 1400 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 8 } },
    spacing: { before: 240, after: 80 },
    children: [new TextRun({
      text: 'Submitted by',
      font: 'Cambria', size: 18, color: INK_LIGHT, characterSpacing: 40,
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: 'Ahmed Raoofuddin', font: 'Cambria', size: 26, bold: true, color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: 'April 2026', font: 'Cambria', size: 20, color: INK })],
  }),
];

// ─── Document Control (standard for ministerial pilot docs) ────────
const docControl = [
  new Paragraph({
    pageBreakBefore: true,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 240 },
    children: [new TextRun({ text: 'Document Control', font: 'Cambria', size: 36, bold: true, color: NAVY })],
  }),
  new Paragraph({
    spacing: { after: 280 },
    children: [new TextRun({
      text: 'This document is submitted as the pilot-phase response to the Ministry of Investment\u2019s AI Case Study. It summarises both the prototype requested in the brief and the additional production-shape primitives that accompany it.',
      font: 'Cambria', size: 22, italics: true, color: INK,
    })],
  }),
  buildTable(
    [2400, 6960],
    ['Field', 'Value'],
    [
      ['Document title',       'InvestUAE Signal Intelligence: Pilot Delivery Document'],
      ['Audience',             'Ministry of Investment of the United Arab Emirates'],
      ['Classification',       'Pilot Release, for ministerial review'],
      ['Author',               'Ahmed Raoofuddin'],
      ['Date of issue',        '20 April 2026'],
      ['Document length',      'Main body with eleven structured diagrams and twenty-two production screenshots'],
      ['Companion artefacts',  'Companies_Identified_List.pdf (live pipeline snapshot, top 25 companies)\nLive platform: https://frontend-iota-seven-30.vercel.app\nSource code: https://github.com/AhmedRaoofuddin/Investment_UAE\nBackend API: https://backend-lyart-three-63.vercel.app\nBackend API docs: https://backend-lyart-three-63.vercel.app/docs'],
      ['Status',               'Pilot release, not a commercial or regulatory submission'],
    ],
    { stripe: true },
  ),
];

// ─── Review Access and Credentials ─────────────────────────────────
// Prominent, reviewer-facing section so the Ministry panel can sign in
// to the authenticated workspace tier without further correspondence.
const credentialsSec = [
  new Paragraph({
    pageBreakBefore: true,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 240 },
    children: [new TextRun({ text: 'Review Access and Credentials', font: 'Cambria', size: 36, bold: true, color: NAVY })],
  }),
  new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({
      text: 'The public signal platform is reachable from any browser without authentication. The authenticated investor workspace tier sits behind sign-in and exposes per-tenant state: watchlists, encrypted connector credentials, notifications and the analytics dashboard. A shared review account has been provisioned specifically for the Ministry of Investment panel so that the workspace tier can be inspected without creating a new tenant.',
      font: 'Cambria', size: 22, italics: true, color: INK,
    })],
  }),
  Eyebrow('Shared review account'),
  buildTable(
    [2400, 6960],
    ['Field', 'Value'],
    [
      ['Sign-in URL',     'https://frontend-iota-seven-30.vercel.app/auth/signin'],
      ['Email address',   'devzalinos@gmail.com'],
      ['Password',        'InvestUAE2026!'],
      ['Account role',    'Tenant owner (full read and write access to the workspace surface)'],
      ['Scope of access', 'Pulse, Overview, Analytics Dashboard, Connections, Watchlist, Notifications inbox'],
      ['Session handling','Auth.js v5 with opaque cookie sessions. Passwords stored as bcrypt hashes.'],
      ['Audit trail',     'Every sign-in, connector write and AI decision taken during the review is recorded as an append-only AuditEntry row, viewable on request.'],
    ],
    { stripe: true },
  ),
  new Paragraph({ spacing: { before: 200 }, children: [] }),
  P(T('This account is isolated from any production tenant and may be rotated at the Ministry\u2019s request. Rate limiting on the sign-in route is capped at five attempts per minute per IP, consistent with the OWASP API4:2023 baseline.')),
];

// ─── Foreword (moved to the front) ─────────────────────────────────
// Note: no forced page break before the H1. The auto TOC field writes
// a trailing paragraph marker; a forced break would orphan that marker
// on its own blank page. H1 itself has keepNext:true so it flows cleanly.
const foreword = [
  H1('Foreword and Acknowledgement'),
  P(T('It is a privilege to write to the Ministry of Investment of the United Arab Emirates. The brief that prompted this work is a thoughtful articulation of a genuine problem, and a problem that matters. Every week, tens of thousands of company announcements land on the public record. Buried within them are the earliest indicators that a firm may be preparing to cross a border, open a regional office, raise growth capital or move its centre of gravity. Surfacing those signals early is the difference between a country that reacts to global capital flows and a country that shapes them.')),
  P(T('The United Arab Emirates has chosen the second path. Every national strategy the Ministry publishes, from the National Artificial Intelligence Strategy 2031 to Net Zero 2050, from Operation 300 billion to Make it in the Emirates, signals the same ambition: a deliberate, forward-looking, disciplined approach to attracting investment that aligns with the nation\u2019s long-term priorities. The case study that this document responds to sits directly within that ambition.')),
  P(T('The work presented here began as a simple prototype in response to the brief. It grew, carefully and intentionally, into a production-shape pilot. The reason is straightforward: an investment signal detection tool for a ministry is not the same thing as an investment signal detection tool for a newsroom. A ministerial tool must be auditable, tenant-isolated, bilingual, compliant with the Personal Data Protection Law, alert to sanctions and politically-exposed persons, and defensible against the kinds of adversarial content that appear in low-trust corners of the open web. Each of those properties has been implemented, tested, and shipped.')),
  P(T('I have taken care to be honest about what has been delivered and what remains. A pilot is not a general availability product, and this document draws that line plainly. Tenant data at rest lives in Frankfurt (Neon, AWS eu-central-1), chosen deliberately for its privacy posture and as a staging point adjacent to the UAE-sovereign general availability target on Microsoft Azure UAE North or G42 Core42, to which the platform will migrate without application code changes. Federated sign-in through UAE PASS, live sanctions-list synchronisation, real-time event-driven surveillance, SOC 2 Type II attestation and region-pinning the Vercel application layer to Frankfurt are scheduled for general availability rather than the pilot, and this document says so without ambiguity.')),
  // keepNext on the final body paragraph and every signature line so Word
  // never orphans the sign-off block onto a page of its own.
  P(T('My sincere thanks to the Ministry for articulating the problem with the clarity it deserves, and for the opportunity to respond. The work below stands as a concrete demonstration of what is possible. I would be glad to take it further under the Ministry\u2019s direction.'),
    { keepNext: true }),
  new Paragraph({ spacing: { before: 240 }, keepNext: true, children: [] }),
  P([
    new TextRun({ text: 'With respect and gratitude,', font: 'Cambria', size: 22, color: NAVY }),
  ], { keepNext: true }),
  P([
    new TextRun({ text: 'Ahmed Raoofuddin', font: 'Cambria', size: 24, bold: true, color: NAVY }),
  ], { keepNext: true }),
  P([
    new TextRun({ text: 'April 2026', font: 'Cambria', size: 20, italics: true, color: INK_LIGHT }),
  ]),
];

// ─── TOC: auto-generated via a Word TOC field (populated by LibreOffice
//     when update_and_export.bas calls oIndexes.update()). Hyperlinked,
//     dot-leader right-aligned page numbers, three heading levels deep. ─
const toc = [
  new Paragraph({
    pageBreakBefore: true,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Table of Contents', font: 'Cambria', size: 36, bold: true, color: NAVY })],
  }),
  new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({
      text: 'Entries are hyperlinked. Use Ctrl + Click in Word or a compatible reader to jump to any section. Page numbers are authoritative.',
      font: 'Cambria', size: 20, italics: true, color: INK_LIGHT,
    })],
  }),
  new TableOfContents('Table of Contents', {
    hyperlink: true,
    headingStyleRange: '1-3',
    rightTabStop: 9360,
    entryAndPageNumberSeparator: '\t',
  }),
];

// ─── Executive Summary ─────────────────────────────────────────────
const exec = [
  H1('Executive Summary', { pageBreak: true }),
  P(T('InvestUAE Signal Intelligence is a production-deployed platform that continuously surveils global open sources, detects early investment signals, and ranks companies by investability and alignment with the United Arab Emirates\u2019 national strategies. It was built in response to the Ministry\u2019s AI Case Study and is operational today.')),
  P([
    T('The public demonstration lives at '),
    new ExternalHyperlink({
      link: 'https://frontend-iota-seven-30.vercel.app',
      children: [new TextRun({ text: 'frontend-iota-seven-30.vercel.app', font: 'Cambria', size: 22, color: '1B4F72', underline: {} })],
    }),
    T(' and is reachable from any browser in any region. The full source code is published at '),
    new ExternalHyperlink({
      link: 'https://github.com/AhmedRaoofuddin/Investment_UAE',
      children: [new TextRun({ text: 'github.com/AhmedRaoofuddin/Investment_UAE', font: 'Cambria', size: 22, color: '1B4F72', underline: {} })],
    }),
    T(' for review by the Ministry\u2019s technical team. The authenticated investor workspace tier sits behind sign-in and adds per-tenant state: watchlists, encrypted connector credentials, notifications and an analytics dashboard designed for analysts inside the Ministry.'),
  ], { alignment: AlignmentType.LEFT }),
  P(T('The platform ingests seventy-six public feeds spanning MENA direct publishers, Arabic-language outlets, global technology media, business wires, sector specialists, founder interviews and primary financial filings. A six-stage artificial intelligence pipeline detects eight categories of investment signal, scores each company on two independent dimensions, and produces a sourced, auditable pipeline suitable for ministerial review. The interface is fully bilingual in English and Arabic with right-to-left layout, and every signal carries an audit trail linking back to its public source.')),
  P(T('The case study requested a simple prototype. What is delivered is a pilot-grade platform with safety, testing and compliance primitives appropriate for ministerial use. Tenant data at rest resides in Frankfurt (Neon, AWS eu-central-1), the closest European Union data-residency region aligned with the Personal Data Protection Law and a deliberate staging point adjacent to the UAE-sovereign general availability target. The Vercel application layer uses Vercel\u2019s global edge during the pilot; pinning it to Frankfurt (fra1) to match the data tier is a configuration change scheduled for general availability alongside the UAE-sovereign migration. No application rewrite is required at any point on that path.')),
  Eyebrow('Key measures at a glance'),
  buildTable(
    [3000, 6360],
    ['Dimension', 'Delivered'],
    [
      ['Public data sources surveilled',        'Seventy-six feeds organised across eleven editorial categories: MENA tech and business (twelve), global expansion candidates (seven), Arabic-language publishers (four), sector specialists (six), founder and executive interviews (five), global business wires (six), deep-tech coverage (six), high-volume wires (thirteen), emerging-markets desks (four), vertical press (ten) and primary financial filings (three, covering SEC EDGAR 8-K and 6-K, Business Wire and PR Newswire).'],
      ['Signal categories detected',            'Eight (funding, expansion, partnership, launch, regulatory approval, hiring, mergers and acquisitions, executive change).'],
      ['Scoring dimensions per company',        'Investability from 0 to 100 and UAE alignment from 0 to 100, with a composite score and named breakdown factors.'],
      ['Language support',                      'English and Arabic with right-to-left layout and a bilingual dictionary of approximately four hundred keys.'],
      ['Workspace connectors',                  'Eighteen paste-API-key connectors across analytics, communications, automation and data sources.'],
      ['Automated tests',                       'One hundred and eighty-one deterministic tests covering agents, services, safety taxonomy and end-to-end integration, running in under one second.'],
      ['Safety taxonomy controls',              'Four UAE-grade controls: sanctions and PEP screening, prompt-injection guard, personally identifiable information redactor and regulated-activity refusal.'],
      ['Data residency for the pilot',          'Tenant data at rest: Frankfurt (Neon managed PostgreSQL, AWS eu-central-1), the closest EU residency region aligned with UAE PDPL expectations and a deliberate staging point adjacent to the UAE-sovereign GA target. Vercel application layer: Vercel global edge during the pilot, to be pinned to Frankfurt (fra1) at general availability. Migration path to Microsoft Azure UAE North or G42 Core42 documented for GA.'],
    ],
  ),
];

// ─── Section 1: Context ────────────────────────────────────────────
const context = [
  H1('1. Context and the Ministry\u2019s Brief'),
  Eyebrow('About the Ministry of Investment'),
  P(T('The Ministry of Investment plays a pivotal role in solidifying the United Arab Emirates\u2019 position as a global investment hub with world-class connectivity to international markets. By attracting foreign direct investment in critical sectors and fostering public and private sector collaboration, the Ministry leverages the UAE\u2019s fit-for-purpose, investor-friendly environment and ambitious economic diversification goals, positioning the nation as a resilient and forward-looking destination for global investors and enterprises.')),
  Eyebrow('About Invest UAE'),
  P(T('Invest UAE is a platform by the Ministry of Investment dedicated to enhancing the UAE\u2019s investment ecosystem and positioning the UAE as a leading global investment hub. Under the Ministry\u2019s leadership, Invest UAE aims to attract and facilitate foreign direct investment across multiple sectors of the UAE\u2019s economy and to encourage partnerships between global investors and nations. Its purpose is to create a setting where people, businesses and capital can thrive, reinforcing the UAE\u2019s position as a compelling investment destination for all.')),
  Eyebrow('The case study'),
  P(T('Background: The Ministry is exploring the development of an AI-powered investment signal detection tool to identify global companies that may be preparing to expand internationally, particularly into the UAE or the region. The goal is to automatically scan sources such as news articles, press releases, interviews and financial announcements to detect early signals of company growth, fundraising or regional expansion plans. By turning large volumes of global information into actionable insights, the tool would help investment teams proactively identify high-potential companies and generate a daily pipeline of potential investors aligned with the UAE\u2019s investment priorities.')),
  P(T('Task: Build a simple prototype that demonstrates how such a tool could work. The prototype should scan publicly available sources from the past three months to identify companies showing potential investment or expansion signals. The output should include a list of companies identified, along with the relevant signals detected, supporting sources and a brief explanation of why they may represent a potential investment opportunity.')),
];

// ─── Section 2: Interpretation ─────────────────────────────────────
const interp = [
  H1('2. Interpretation of the Task'),
  P(T('The brief was read as a request for a demonstrable signal detection tool that a ministerial audience could review with confidence. The minimum was delivered first, and was then surrounded by the primitives required for a pilot: a bilingual interface, an authenticated investor workspace, encrypted token storage, an append-only audit log, a safety taxonomy aligned with UAE regulatory expectations, and an automated test suite that guards against regression on every change.')),
  P(T('Each design choice was motivated by practical reasoning rather than ambition for its own sake. Bilingual support was included because the audience the Ministry serves is bilingual. Encryption at rest was included because any tool that will hold third-party API credentials has to treat them with care. The safety taxonomy was included because a ministerial platform surfacing companies to investment officers must never surface a sanctioned entity, and must never be coaxed by adversarial content into producing regulated financial advice.')),
  P(T('The platform was also designed to degrade gracefully. Every artificial intelligence agent ships with a deterministic fallback path that produces meaningful output without any external language model. The Anthropic Claude layer is an optional enhancement, not a dependency. Every language model call flows through a single audited chokepoint that writes an audit entry and enforces refusal rules. If the Claude layer is unreachable, the platform continues to detect signals, score companies and serve analysts. This is a deliberate choice for continuity in a ministerial context.')),
  P(T('The ambition was not to over-engineer. It was to deliver a prototype that, should the Ministry elect to take it forward, could be handed to a pilot team tomorrow.')),
];

// ─── Section 3: Solution Overview ──────────────────────────────────
const solution = [
  H1('3. Solution Overview'),
  P(T('InvestUAE Signal Intelligence is a web platform with two product surfaces. A public signal platform provides a demonstration of the signal pipeline that is visible to any visitor. A private investor workspace, gated by sign-in, provides per-tenant analyst tools on top of the same underlying pipeline.')),
  H3('Public signal platform'),
  P(T('The public platform presents a live, ranked signal pipeline across every scanned source. It includes a signal feed, a company pipeline with filters and sort, a per-company dossier view, a geo-intelligence map, sector analytics and a methodology page that documents how signals are detected and scored. Every signal links back to its original public source, carries a type tag and strength badge, and is accompanied by a brief rationale that explains why the signal matters.')),
  H3('Investor workspace'),
  P(T('The workspace adds per-tenant state: watchlists across companies, sectors, regions and keywords; notifications when a signal matches a watchlist entry; an eighteen-connector catalogue that lets a tenant dispatch matches to its own downstream tools; and an analytics dashboard with trend charts, leaderboards, a strength radial and a publisher distribution view. Every tenant-owned row carries a tenant identifier, and every query includes it. Cross-tenant joins are forbidden by convention.')),
  H3('Daily pipeline delivery'),
  P(T('A daily cron at 06:00 UTC refreshes the pipeline, and a second cron at 07:00 UTC assembles the day\u2019s digest: the top high-conviction companies detected in the last twenty-four hours, ordered by composite score. The digest is created as a notification for every tenant and fans out through every channel the tenant has connected, whether Slack, Microsoft Teams, email, a custom webhook or an in-app inbox entry. Analysts therefore receive the actionable daily pipeline without needing to open the platform.')),
  H3('Bilingual, right-to-left interface'),
  P(T('The entire product is rendered in English and Arabic. The bilingual dictionary contains approximately four hundred translated keys. Selecting Arabic swaps the page direction to right-to-left, substitutes the font stack to Noto Naskh Arabic for body copy and Noto Serif Display for headlines, and mirrors directional iconography throughout the interface. The backend surveils six native Arabic-language sources alongside the English-language feeds so that Arabic speakers do not experience a subset of the global picture.')),
];

// ─── Section 4: Platform Walkthrough ───────────────────────────────
const walkthrough = [
  H1('4. Platform Walkthrough', { pageBreak: true }),
  P(T('The screenshots below are taken directly from the live production deployment. All data shown is real and sourced from the active signal pipeline. Each screen is captioned with a short note on what the analyst sees and what the interface is optimised for.')),

  H2('4.1 Public home page'),
  Screenshot('01_home_en.png'),
  Caption('The public landing page. A three-slide hero narrates the value proposition while the navigation exposes the live signal platform, the investment rationale, the reports library and the sign-in route.'),

  H2('4.2 Live signal feed'),
  Screenshot('02_signals_en.png'),
  Caption('The live signal feed. Each card carries a type tag, a strength badge, a publisher attribution and a short rationale. Filters allow narrowing by signal type or strength.'),

  H2('4.3 Company pipeline'),
  Screenshot('03_companies_en.png'),
  Caption('The ranked company pipeline. Each card surfaces the investability and UAE alignment scores, headquarters location, known sectors and the number of active signals detected in the rolling ninety-day window.'),

  H2('4.4 Geo-intelligence map'),
  Screenshot('04_geo_en.png'),
  Caption('The geo-intelligence map plots each company\u2019s headquarters and its stated expansion targets. Dashed rings indicate declared intent into the UAE or the wider MENA region.'),

  H2('4.5 Sector analytics'),
  Screenshot('05_sectors_en.png'),
  Caption('Sector analytics aggregate signals across fifteen strategic sectors, with a composite score per sector aligned to national strategies such as the Artificial Intelligence Strategy 2031, Net Zero 2050 and Operation 300 billion.'),

  H2('4.6 Why Invest in the UAE'),
  Screenshot('06_why_invest_en.png'),
  Caption('The investment rationale page, using the Ministry\u2019s own pillar iconography sourced from the official Invest UAE portal.'),

  H2('4.7 Reports and data'),
  Screenshot('07_reports_en.png'),
  Caption('The reports page links to the Ministry\u2019s own open data publications. Every link is verified directly against investuae.gov.ae.'),
];

// ─── Section 5: Arabic ─────────────────────────────────────────────
const bilingual = [
  H1('5. Arabic and Bilingual Interface'),
  P(T('The platform ships with full English and Arabic parity. All visible strings flow through a dictionary that is maintained in lockstep across both languages. Selecting Arabic swaps the page direction to right-to-left, substitutes the font stack, and mirrors directional iconography such as navigation chevrons and arrow glyphs.')),
  P(T('Arabic is treated as a first-class language in the pipeline, not an afterthought at the presentation layer. Six native Arabic-language feeds are ingested by the backend: Al Khaleej, BBC Arabic Business, Aawsat, Youm7, Al Watan and Sputnik Arabic. Company names and publisher attributions remain in their source language by design, which preserves accurate attribution for an Arabic-speaking analyst who will also read non-Arabic sources.')),

  H2('5.1 Arabic home page'),
  Screenshot('16_home_ar.png'),
  Caption('The public home page rendered in Arabic. The layout mirrors right-to-left, the body font switches to Noto Naskh Arabic and the headlines to Noto Serif Display.'),

  H2('5.2 Arabic signal feed'),
  Screenshot('17_signals_ar.png'),
  Caption('The signal feed in Arabic. Signal types, strength labels, timestamps and filters all translate.'),

  H2('5.3 Arabic company pipeline'),
  Screenshot('18_companies_ar.png'),
  Caption('The ranked company pipeline in Arabic. Scores, labels and sort controls mirror correctly to the right-hand side.'),

  H2('5.4 Arabic geo-intelligence map'),
  Screenshot('19_geo_ar.png'),
  Caption('The geo-intelligence map in Arabic. The legend and statistics re-render in Arabic while the map itself remains language-agnostic.'),

  H2('5.5 Arabic investor workspace'),
  Screenshot('21_workspace_pulse_ar.png'),
  Caption('The authenticated workspace pulse view in Arabic, rendered right-to-left for Arabic-speaking analysts.'),

  H2('5.6 Arabic analytics dashboard'),
  Screenshot('22_workspace_dashboard_ar.png'),
  Caption('The analytics dashboard in Arabic, with KPI tiles, trend charts and ranked leaderboards.'),
];

// ─── Section 6: Investor Workspace ─────────────────────────────────
const workspaceSec = [
  H1('6. Investor Workspace'),
  P(T('The investor workspace is the authenticated product surface. It sits behind an email and password sign-in and adds per-tenant state on top of the shared signal pipeline. A new sign-up provisions a tenant, the first user as the tenant owner, and an initial audit trail entry. The UAE PASS subject identifier field is already present in the schema so that a future migration to federated sign-in requires no schema change.')),

  H2('6.1 Sign in'),
  Screenshot('08_signin.png'),
  Caption('Sign in form. Credentials are collected over TLS. Passwords are stored as bcrypt hashes. Sessions are issued as opaque cookies, never as JSON Web Tokens in the browser.'),

  H2('6.2 Sign up'),
  Screenshot('09_signup.png'),
  Caption('Sign up form. A new sign-up creates a tenant row, a user row, an audit entry and a default watchlist. Rate limiting is applied per IP to deter automated account creation.'),

  H2('6.3 Workspace pulse'),
  Screenshot('10_workspace_pulse_en.png'),
  Caption('The pulse view is the first screen an analyst sees after sign-in. A desert-satellite canvas renders signal points across the region and the live stream of matched signals sits on top. Watchlist match count and unread notification count are shown at a glance.'),

  H2('6.4 Overview'),
  Screenshot('11_workspace_overview_en.png'),
  Caption('The overview consolidates key tenant metrics: match volume, sector mix, freshest companies and the most active publishers over the rolling thirty-day window.'),

  H2('6.5 Analytics dashboard'),
  Screenshot('12_workspace_dashboard_en.png'),
  Caption('The analytics dashboard. Eight key performance indicator tiles, a thirty-day area trend for total signals against matched signals, a signal-type donut, a top-ten company leaderboard, a sector intensity chart and a strength radial. All aggregates are computed server-side from the tenant\u2019s pipeline slice.'),

  H2('6.6 Connections'),
  Screenshot('13_workspace_connections_en.png'),
  Caption('The connections catalogue with eighteen paste-API-key connectors across four categories: analytics, communications, automation and data sources. Every secret is sealed by AES-256-GCM with a per-tenant data encryption key before it touches the database.'),

  H2('6.7 Watchlist'),
  Screenshot('14_workspace_watchlist_en.png'),
  Caption('The watchlist editor. Analysts flag companies, sectors, regions or keywords. Preset chips provide a first-time onboarding path. Matched signals are dispatched to the connected channels.'),

  H2('6.8 Notifications inbox'),
  Screenshot('15_workspace_notifications_en.png'),
  Caption('The notifications inbox with severity tiers, bulk archive and a five-minute cooldown on AI briefings to cap language model spend.'),
  H2('6.9 Notification lifecycle'),
  P(T('Each notification progresses through a small, explicit state machine. The analyst can mark an unread notification as read, move a read notification back to unread, or archive any notification. Bulk actions allow archiving every AI briefing or every read notification in a single click. Archived notifications are retained for the audit window and then removed.')),
  Diagram('d9_notification_state.png', 520),
  Caption('Notification lifecycle state diagram.'),
];

// ─── Section 7: System Architecture (new, with component diagram) ──
const architecture = [
  H1('7. System Architecture'),
  P(T('The system follows a conventional, modern web architecture: a Next.js frontend on Vercel Edge for the user interface and static assets, a FastAPI backend on Vercel Python for the signal detection pipeline, a managed PostgreSQL database on Neon for tenant state, and an optional enhancement layer that calls Anthropic\u2019s Claude models through a single audited chokepoint. Every component was chosen for operability and portability rather than novelty.')),
  Diagram('d4_component.png', 620),
  Caption('System component diagram. The dashed arrow indicates an optional dependency: the Anthropic Claude layer is used to enrich extraction and thesis generation, but the platform produces meaningful output without it.'),
  H2('7.1 Deployment topology'),
  P(T('The deployment diagram below shows the physical topology of the running platform during the pilot. Tenant data at rest resides in Frankfurt (Neon managed PostgreSQL in AWS eu-central-1). The Vercel application layer is served through Vercel\u2019s global edge during the pilot and will be pinned to Frankfurt (fra1) at general availability; the Vercel Edge point of presence terminates TLS, applies the middleware layer and forwards authenticated requests to the Next.js serverless function, which in turn reaches the FastAPI backend and the Neon database.')),
  Diagram('d7_deployment.png', 620),
  Caption('Deployment diagram. The pilot data tier resides in Frankfurt; the Vercel application layer uses Vercel\u2019s global edge and will be region-pinned to Frankfurt at general availability. The migration to UAE-sovereign hosting replaces both tiers in place, and the topology above stays the same.'),
  H2('7.2 Use cases'),
  P(T('The use case diagram below summarises the four primary actors that interact with the platform and the twelve core use cases they exercise. The analyst and the public visitor share the read-only pipeline surfaces; only the analyst has write access to watchlists and connectors. The auditor role is a notional actor today, served by the append-only audit log; a dedicated read-only role will be added for general availability.')),
  Diagram('d8_use_case.png', 620),
  Caption('Use case diagram. Four primary actors: Ministry analyst, public visitor, operations auditor and external system.'),
  H2('7.3 Layered architecture'),
  P(T('The codebase is organised as five layers. The presentation layer is Next.js App Router with React components and the locale provider. The middleware layer applies Content Security Policy, authentication and rate limiting to every request. The domain layer contains the artificial intelligence agents, the safety taxonomy, the pipeline orchestrator and the connector registry. The infrastructure layer hosts the FastAPI router, the Prisma ORM, the audited language model client and the notification channel dispatchers. The data layer holds the managed PostgreSQL, the disk cache, the external RSS feeds and the external Claude API.')),
  Diagram('d11_layered_architecture.png', 620),
  Caption('Layered architecture. Sand-tinted boxes are internal modules. Gold-tinted boxes carry safety responsibilities that must not be bypassed.'),
  P(T('The frontend is written in TypeScript on Next.js version 16 using the App Router. The App Router allows us to mix server components, which render on the edge and produce fully formed HTML for the initial paint, with client components that provide interactivity in the investor workspace. Middleware runs on every request and applies the Content Security Policy nonce, HTTP Strict Transport Security, rate limiting and the authentication gate that protects the workspace tier. Styling is handled by Tailwind CSS version 4, chosen for its atomic class model and its ability to keep the produced bundle small.')),
  P(T('The backend is written in Python 3.12 and built on FastAPI. FastAPI was selected for three reasons: it is idiomatic for asynchronous input and output, which suits the fan-out fetch pattern used by the RSS aggregator; it produces a machine-readable OpenAPI document out of the box, which is valuable for downstream integration; and it has a small, readable source base that is easy to reason about during an audit.')),
  P(T('The data layer is Neon\u2019s managed PostgreSQL service, hosted in AWS eu-central-1 in Frankfurt. PostgreSQL was chosen for its stability, its vibrant ecosystem, and its strong guarantees around transactional integrity. Neon in particular was chosen because it provides branching, which allows a database-per-environment workflow during the pilot, and because it is a fully portable PostgreSQL that can be replaced by a self-managed PostgreSQL on Microsoft Azure UAE North or G42 Core42 for general availability without any schema or query change.')),
  H2('7.1 Frontend architecture (Next.js App Router)'),
  P(T('The frontend uses Next.js\u2019s App Router with a deliberate split between server and client components. Marketing pages and the public signal platform are server components, which means the initial HTML is fully rendered on the edge and arrives at the browser with no hydration penalty. Interactive surfaces such as the filter controls on the signal feed, the watchlist editor and the connector paste form are client components that hydrate only where interactivity is needed. This split keeps the JavaScript bundle small and the time-to-first-byte short.')),
  P(T('Internationalisation is handled by a lightweight React context provider rather than the heavier next-intl library. This decision was made because we wanted to avoid adding a localised route prefix across the twenty-five pages of the platform. The provider reads a cookie and a localStorage entry, exposes a translation function and the current locale, and sets the language attribute and direction attribute on the HTML element for right-to-left support. It is small, testable and does not impose route-level constraints.')),
  H2('7.2 Backend architecture (FastAPI with async agents)'),
  P(T('The backend is organised as a set of agents and services. Agents implement artificial intelligence logic (embedding, classification, entity extraction, scoring). Services implement input and output and side effects (RSS aggregation, geo enrichment, pipeline cache, the optional Claude wrapper). An orchestrator wires them together.')),
  P(T('Asynchrony is used where it genuinely helps. The RSS aggregator fans out across seventy-six feeds concurrently with a bounded-concurrency asyncio gather, using httpx for HTTP and feedparser for parsing. The Open Graph image enrichment pass runs a second bounded-concurrency fetch against any article that did not embed an image in its feed body, rotating user agents so that publishers who whitelist social-media crawlers (for example Finextra and Bloomberg) still return their image metadata. Classification, entity extraction and scoring are CPU-bound and run in sequence; the pipeline is short enough that per-article parallelisation would not measurably improve wall-clock time.')),
  P(T('All language model calls pass through a single audited wrapper. This wrapper reads the same environment variable, applies the same timeouts, enforces the same output token budgets, writes the same audit log entry, and is the only place in the codebase allowed to import the Anthropic SDK. Direct SDK use anywhere else is forbidden by convention and enforced by code review. This is a meaningful primitive: it means that if the Ministry wishes to swap Claude for another provider or to apply a different policy, the change is made in one file, not scattered across agents.')),
];

// ─── Section 8: AI Agent Framework (new, with class diagrams) ──────
const agentsSec = [
  H1('8. AI Agent Framework'),
  P(T('The artificial intelligence layer is an explicit, named set of agents. Each agent has a single responsibility, a clean public interface, a deterministic fallback path and a full suite of unit tests. The agents are coordinated by an orchestrator that holds no mutable state of its own; it simply composes the agents in the right order and hands off the result to the pipeline cache.')),
  Diagram('d1_agents.png', 620),
  Caption('Class diagram: the five agents of the backend pipeline. Solid arrows denote composition (one agent uses another). Dashed arrows denote return types.'),
  H2('8.1 Embedding Agent'),
  P(T('The embedding agent produces 384-dimensional dense vectors for any text it is given. When the sentence-transformers model is available, it uses MiniLM, which is a compact, well-characterised model with excellent cost-to-quality properties for a scanning workload. When the model is not available, for example in a lightweight deployment or a continuous integration environment, it falls back to a deterministic hash encoder that produces unit-length vectors with meaningful similarity signal. The fallback is not a placeholder; it is tested and is used in production when the model is unreachable. This is how the platform continues to function when an external dependency is down.')),
  H2('8.2 Classifier Agent'),
  P(T('The classifier agent labels each article with a signal type and a signal strength. It blends two signals: an embedding-similarity score (sixty percent) against natural-language descriptions of each signal type, and a keyword regex score (forty percent). The keyword regex pass is deliberate and thorough. Every signal type has between a dozen and two dozen phrase patterns, tuned against real MENA and global press headlines. The embedding-similarity pass catches phrasings the keyword patterns miss. Their blend is more accurate than either signal alone.')),
  H2('8.3 Entity Agent'),
  P(T('The entity agent extracts company names, headquarters locations, expansion targets, funding amounts and executive mentions. It is entirely deterministic. A carefully curated gazetteer maps fifty MENA and global cities to coordinates and country codes. Company name recognition uses a set of action-verb patterns (for example "Company X raises", "Company X expands", "Company X appoints") followed by a fragment filter that rejects clause-level captures. The fragment filter is one of the most-reviewed pieces of code in the backend, because over-rejection and under-rejection both produce visible harm.')),
  H2('8.4 Scoring Agent'),
  P(T('The scoring agent produces two independent scores on a zero-to-one-hundred scale. Investability combines signal momentum (weighted by type and strength with diminishing returns after five signals), funding maturity, sector fit, signal diversity and semantic quality. UAE alignment combines geographic presence (headquarters in the UAE, the Gulf, or MENA), expansion intent toward the UAE, strategic sector fit using sector weights aligned to national strategies, UAE-specific signal relevance and semantic alignment with strategy texts. The weights are codified in the source and are testable against named expectations: for example, a test pins the fact that artificial intelligence has the highest sector weight, because the Artificial Intelligence Strategy 2031 places it there.')),
  H2('8.5 Orchestrator'),
  P(T('The orchestrator is a small module with a single public method. It runs the RSS aggregator, passes articles to the entity agent, then to the classifier agent, then through the safety gate, then to the scoring agent, and finally into the additive merge step. It is the only place in the backend that knows about the pipeline as a whole. Individual agents know nothing about each other and are unit-tested in isolation.')),
];

// ─── Section 9: AI Pipeline (keeps the sequence diagram) ───────────
const pipelineSec = [
  H1('9. AI Signal Detection Pipeline'),
  P(T('Every article surveilled by the platform passes through six deterministic stages. The pipeline is offline-safe end to end: every stage runs without a live language model call. The optional Anthropic Claude layer enriches the structured extraction and the per-company thesis, but the platform produces a complete ranked pipeline whether the Claude layer is available or not.')),
  Diagram('d3_pipeline_sequence.png', 620),
  Caption('Sequence diagram of the pipeline, from RSS fan-out to surfaced signal.'),
  H2('9.1 Data flow'),
  P(T('The data flow below is a simplified view of the same pipeline, suitable for reviewers who want to verify that every path through the system passes through the safety gate before reaching an analyst.')),
  Diagram('d10_data_flow.png', 620),
  Caption('Data flow diagram. Gold-tinted boxes are safety checkpoints; no signal reaches an analyst without passing through all of them.'),
  buildTable(
    [720, 2100, 4200, 2340],
    ['Stage', 'Name', 'Responsibility', 'Technology'],
    [
      ['1', 'RSS aggregation',          'Asynchronous fan-out across seventy-six public feeds covering news wires, business press, Arabic-language publishers, founder and executive interviews, sector specialists and primary financial filings. Ninety-day rolling window, URL-hash deduplication, bounded-concurrency Open Graph image enrichment with user-agent rotation.', 'httpx, feedparser, lxml'],
      ['2', 'Entity extraction',        'Company names, headquarters, expansion targets, funding amounts, executives. Regex plus a fifty-city gazetteer, with a fragment filter that rejects clause-level noise.',            'Pure Python, rapidfuzz'],
      ['3', 'Zero-shot classification', 'Each article is labelled as one of eight signal types with confidence and strength. Sixty percent embedding similarity, forty percent keyword regex blend.',                          'sentence-transformers optional, hash fallback'],
      ['4', 'Safety gate',              'Blocks sanctioned entities, queues politically-exposed persons for enhanced due diligence, rejects prompt-injection patterns, redacts personally identifiable information, refuses regulated-activity queries.', 'app/safety'],
      ['5', 'Multi-factor scoring',     'Investability and UAE alignment, each from zero to one hundred with named breakdown factors.',                                                                                         'Heuristic weights aligned to national strategies'],
      ['6', 'Additive merge',           'Unions with the previous snapshot on a thirty-day sliding window, keeps the fifteen freshest signals per company, caps the pool at two hundred by composite score. Six-hour cache.',                     'Asyncio lock, file-backed JSON'],
    ],
  ),
  P(T('The eight signal categories are chosen because they empirically correlate with expansion intent and growth momentum. Funding rounds, regional expansion announcements, strategic partnerships, product launches, regulatory approvals, significant hiring, mergers and acquisitions, and executive changes. Each category carries its own weight in the investability score, and each company can carry multiple signals at once.')),
];

// ─── Section 10: Safety Taxonomy (with class + flow diagrams) ──────
const safetySec = [
  H1('10. Safety Taxonomy and Compliance'),
  P(T('Investment signal intelligence in a ministerial context demands a higher safety bar than a commercial product. Four deterministic controls sit between every surveilled article and every surfaced signal. They are implemented in code today, tested on every commit, and designed to produce forensically defensible audit evidence.')),
  Diagram('d6_safety_flow.png', 600),
  Caption('Decision flow: how a source article moves through the four safety controls to reach an analyst.'),
  H2('10.1 How the taxonomy was designed'),
  P(T('The taxonomy was not chosen in the abstract. It was derived from four questions that a ministerial reviewer would reasonably ask of any artificial intelligence tool operating in a financial context. First: can this tool surface a sanctioned entity to an analyst? The sanctions and PEP screen answers that question. Second: can an adversarial article steer the tool into producing nonsense or leaking a system prompt? The prompt-injection guard answers that. Third: can personally identifiable information leak from the source into an outgoing notification, an email or a dashboard export? The PII redactor answers that. Fourth: can the tool be persuaded to produce regulated financial advice, insider analysis or sanctions-evasion guidance? The regulated-activity refusal guard answers that.')),
  P(T('Each control has a well-defined input, a well-defined output and a named failure mode. Each is tested against positive cases (where the control must fire) and negative cases (where legitimate content must pass through). Both sides matter. A control that never misses but also over-blocks is not useful in practice because analysts lose confidence in it.')),
  Diagram('d2_safety.png', 620),
  Caption('Class diagram: the four safety modules. Each has a simple public method and returns a small, explicit result object. The result objects are what get logged to the audit trail.'),
  H2('10.2 Controls, standards and test coverage'),
  buildTable(
    [2200, 2100, 2900, 2160],
    ['Control', 'Standard', 'What it catches', 'Tests'],
    [
      ['Sanctions and PEP screen',               'OFAC SDN, UN Consolidated, EU FSF, FATF Recommendation 12',             'Sanctioned entities and aliases, diacritic-laundered names, politically-exposed persons queued for enhanced due diligence.', '13'],
      ['Prompt-injection guard',                 'OWASP LLM01',                                                          'Instruction override, ChatML takeover, secret exfiltration patterns, exfiltration channels, delimiter spoofs.',              '18'],
      ['Personally identifiable data redactor',  'UAE Personal Data Protection Law Article 10',                          'Emirates ID numbers, AE IBAN, UAE mobile, international phone, email addresses.',                                            '15'],
      ['Regulated-activity refusal',             'UAE SCA guidance, DFSA Conduct of Business',                           'Personalised investment advice, insider information, sanctions-evasion queries, market-manipulation playbooks.',             '22'],
      ['Encryption at rest',                     'NIST SP 800-38D',                                                      'AES-256-GCM with per-tenant data encryption keys via HKDF over a master key, rotation-safe.',                                'Schema-pinned'],
      ['Transport security',                     'OWASP ASVS Level 2',                                                   'Strict Content Security Policy with per-request nonce, Trusted Types, HSTS, Cross-Origin isolation, Permissions Policy.',    'Middleware-enforced'],
      ['Rate limiting',                          'OWASP API4:2023',                                                      'Token-bucket per IP and route: sign-in five per minute, connector writes ten per minute, deep-dive AI calls twenty per minute.', 'Deterministic'],
      ['Tenant isolation',                       'Defence in depth',                                                     'Every query carries a tenant identifier. Cross-tenant joins are forbidden by convention and enforced by code review.',        'Schema-pinned'],
      ['Append-only audit log',                  'UAE PDPL Article 23, ADGM and DIFC procurement',                       'Every state change and every AI decision is recorded. Hashes only, never the underlying bodies.',                             'Schema-pinned'],
    ],
  ),
  P(T('Compliance posture: the platform is designed to align with the UAE Personal Data Protection Law (Articles 10 and 23), Financial Action Task Force Recommendation 12 on politically-exposed persons, Abu Dhabi Global Market and Dubai International Financial Centre anti-money-laundering expectations, and baseline OWASP controls (ASVS Level 2, Large Language Model Top 10). It is not a substitute for a formal SOC 2 Type II or ISO 27001 certification, which are scheduled for general availability rather than the pilot.')),
];

// ─── Section 11: Database Design (new, with ER diagram) ────────────
const dbSec = [
  H1('11. Database Design and Rationale'),
  P(T('A ministerial platform is defined as much by the data it holds and how it holds it as by the software that runs on top. The database is managed PostgreSQL, accessed through Prisma as the schema authority and as the type-safe client. The choice of PostgreSQL is conservative and reasoned. It is the most widely reviewed open-source relational database in the world. It has strong guarantees around isolation levels and transactional integrity. It has a vast ecosystem of audit, backup and migration tooling. And, importantly for a ministerial platform, it is portable: a PostgreSQL database in Frankfurt today can become a PostgreSQL database in UAE North tomorrow with no schema rewrite.')),
  P(T('Neon was chosen as the managed PostgreSQL vendor for the pilot because of three specific properties. First, Neon produces vanilla PostgreSQL, which means no vendor-specific query dialect and no lock-in to a proprietary API. Second, Neon supports database branching, which allows each development environment to operate on its own isolated branch without consuming a separate database instance. Third, the Frankfurt region (eu-central-1) places the data within the European Union and satisfies Personal Data Protection Law residency expectations during the pilot. For general availability, the same schema and the same queries will run on Microsoft Azure UAE North or G42 Core42 with no application-level change.')),
  Diagram('d5_er.png', 620),
  Caption('Entity-relationship diagram for the pilot schema. Every tenant-owned table carries a tenant identifier and a strict foreign-key relationship to the Tenant row.'),
  H2('11.1 Multi-tenant isolation'),
  P(T('The schema is multi-tenant by the tenant identifier column. Every tenant-owned row carries a tenant identifier and every query includes it in its where clause. Helpers such as requireSession return the active tenant identifier on every authenticated request, and Prisma queries consume it by design. Cross-tenant joins are forbidden by convention and enforced by code review, which is a pragmatic and inspectable baseline for the pilot. For general availability, PostgreSQL row-level security policies can be introduced as a second layer of defence, so that the database itself rejects a query that forgets to include the tenant identifier.')),
  H2('11.2 Secret storage'),
  P(T('Third-party API credentials (for example Power BI, Tableau or Slack webhook secrets) are never stored in plaintext on the connection row. They live in a separate table called ConnectionSecret, where the ciphertext field is a raw bytes column produced by AES-256-GCM. The key used to seal the ciphertext is a per-tenant data encryption key derived via HKDF from a master key stored in the environment. This design means that a database reader with full access to the tables still cannot read secrets, and that rotation of the master key does not require re-entering the source credentials: each ciphertext can be re-encrypted in place.')),
  H2('11.3 Audit trail'),
  P(T('Every state change writes a row to the AuditEntry table. Every artificial intelligence decision writes a row to the same table. The Prisma model that exposes AuditEntry does not expose update or delete methods; writes are append-only by convention and by code review. Audit rows record the action name, a subject identifier, a metadata JSON blob that never contains secrets, and the requesting IP and user agent for forensic context. This is the record that a ministerial auditor would review to trace an incident, and it is designed to survive that review.')),
];

// ─── Section 12: Testing (new, with test philosophy and examples) ──
const testingSec = [
  H1('12. Testing Philosophy and Evidence'),
  P(T('Ministerial-grade software ships with a ministerial-grade test suite. One hundred and eighty-one automated tests accompany the codebase. Every test is deterministic and fully offline: no test hits a live language model, a live news feed or a live database. Fixtures are committed alongside the tests so the full suite is reproducible on a fresh clone, on a clean continuous-integration runner or on an auditor\u2019s laptop.')),
  H2('12.1 Philosophy'),
  P(T('The testing philosophy behind the suite can be stated in three sentences. First, the safety taxonomy is a hard gate: a single failure halts the build. Second, deterministic fallback paths are tested, not just present. If the embedding agent has a hash fallback, the fallback itself has shape, determinism and coverage tests. Third, the tests cover both positive and negative cases. A classifier that only recognises the phrase "raises funding" is brittle; a classifier that is tested against twenty phrasings of every signal type, and also against ten phrasings of legitimate non-signal text that it must not classify, is robust.')),
  H2('12.2 Layered test suite'),
  buildTable(
    [2600, 900, 5860],
    ['Layer', 'Tests', 'Coverage'],
    [
      ['Agents (entity, classifier, embedding, scoring)', '85',  'Company name validation and gazetteer integrity. All eight signal types across keyword and strength paths. Vector shape, determinism and theme coverage. Sector weight hierarchy (artificial intelligence at the top, fintech in the top five), geographic boost (UAE above Gulf above rest of world) and breakdown integrity.'],
      ['Services (geo enricher, pipeline cache)',          '20',  'Centroid resolution for MENA and Gulf cities, Gulf Cooperation Council coverage guard, time-to-live freshness, disk round-trip and concurrent writes.'],
      ['Safety taxonomy',                                  '68',  'Ministry-critical hard gate. Sanctions and PEP screen against public OFAC and UN data. Prompt injection across five categories. Personally identifiable information including Emirates ID and AE IBAN. Regulated-activity refusal across insider information, manipulation and sanctions-evasion queries.'],
      ['End-to-end integration',                           '8',   'Full pipeline runs over hand-curated MENA fixture articles. Proves the entire flow from raw RSS text through a scored, safety-filtered company record.'],
    ],
  ),
  H2('12.3 Representative test cases'),
  P(T('A representative sample from the safety layer makes the discipline concrete. The sanctions test suite asserts that a headline reading "Wagner Group announces new recruits" is blocked with confidence 1.0 and program attribution RUSSIA-EO14024. It asserts that "IRGC commander addressed the conference" is flagged as an alias match with confidence 0.9. It asserts that "Iranian-American entrepreneur builds fintech startup" is not blocked, because word-boundary matching correctly distinguishes the two. A legitimate MENA fundraising headline such as "Lean Technologies raises sixty-seven million dollars Series B led by General Catalyst" is tested to pass all four controls cleanly and to be scored with an investability score above fifty and an alignment score above sixty.')),
  P(T('The classifier tests pin one observation that deserves a note. Speculative text such as "Reportedly considering an IPO in 2027" is classified as low strength, because speculative language should not drive high-priority investor decisions. However, if the same text contains a high-strength anchor (a concrete Series B, a regulatory licence grant, a named funding amount), the strength tier is raised. This is documented behaviour, pinned by tests, and reflects the intent of the scoring logic.')),
  H2('12.4 Continuous integration'),
  P(T('The continuous-integration pipeline runs on every push and every pull request. It runs the backend test suite, runs the safety suite explicitly as a second named step so a safety regression is immediately visible as a failed check, runs the TypeScript type checker on the frontend, runs a production build of the frontend, and runs the gitleaks secrets scanner across the diff. A failure of any step blocks the merge.')),
];

// ─── Section 13: Deployment and Operations ─────────────────────────
const deploy = [
  H1('13. Deployment, Operations and Residency'),
  P(T('The platform is deployed today on Vercel for the application surface and on Neon for the data tier. Tenant data at rest resides in Frankfurt (Neon managed PostgreSQL, AWS eu-central-1). This was the deliberate privacy choice for the pilot: Frankfurt is the closest European Union data-residency region aligned with the UAE Personal Data Protection Law, and a defensible staging point adjacent to the UAE-sovereign general availability target. The Vercel application layer uses Vercel\u2019s global edge routing during the pilot; pinning the application region to Frankfurt (fra1) to match the data tier is a single-line change in \u0060vercel.json\u0060 (\u0060"regions": ["fra1"]\u0060) scheduled for general availability alongside the broader UAE-sovereign migration. The deployment is deliberately portable.')),
  buildTable(
    [3000, 6360],
    ['Surface', 'URL'],
    [
      ['Public marketing site and signal platform',  'https://frontend-iota-seven-30.vercel.app'],
      ['Authenticated investor workspace',           'https://frontend-iota-seven-30.vercel.app/workspace'],
      ['Signal detection API',                       'https://backend-lyart-three-63.vercel.app'],
      ['API documentation (OpenAPI)',                'https://backend-lyart-three-63.vercel.app/docs'],
      ['Source code repository',                     'https://github.com/AhmedRaoofuddin/Investment_UAE'],
    ],
  ),
  P(T('Every sign-in, every connector write, every artificial intelligence decision and every state change writes an append-only audit entry. Rate limits are enforced at the edge through the middleware layer. Secrets are never logged in their plaintext form. Deployments require the continuous integration pipeline to pass. There is no direct database access outside the application layer.')),
  H2('13.1 Migration path to UAE-sovereign hosting'),
  P(T('The deployment is portable by design. The application stack is vanilla Next.js and vanilla FastAPI with a standard PostgreSQL back end. A migration to Microsoft Azure UAE North or G42 Core42 for general availability requires provisioning managed PostgreSQL in the target region, updating the connection string in the environment, redeploying the application containers and pointing the domain to the new edge. No application code changes are required. Pinning the Vercel application region from global edge routing to Frankfurt (fra1) during the same migration window is a single-line configuration change in \u0060vercel.json\u0060. The Frankfurt data residency today is compatible with the UAE Personal Data Protection Law and European General Data Protection Regulation. It is a pilot decision, not a long-term constraint.')),
  H2('13.2 Operational observability'),
  P(T('Beyond the audit log, observability today is limited to platform-native logs and metrics on Vercel and Neon. For general availability this would be supplemented by OpenTelemetry tracing, structured logs exported to Splunk or the Elastic stack, and a real-time metrics dashboard fed by Prometheus or Datadog. These additions are deferred for the pilot and are flagged in the roadmap section.')),
];

// ─── Section 14: Future Scope ──────────────────────────────────────
const future = [
  H1('14. Future Scope and Path to General Availability'),
  P(T('The pilot is deliberately bounded. The capabilities below are designed in but not yet shipped, and would be the focus of a general availability programme should the Ministry elect to take the platform forward. Each row distinguishes the status today from the target state for general availability.')),
  buildTable(
    [3500, 2100, 3760],
    ['Capability', 'Status today', 'General availability target'],
    [
      ['UAE PASS federated sign-in',                       'Scaffolded, subject identifier field present', 'Wired to the national identity provider.'],
      ['Microsoft Entra ID and WorkOS directory sync',     'Deferred',                                     'Required for enterprise sign-in and group-to-role mapping.'],
      ['Sumsub KYB callback',                              'Schema stub',                                  'Wired for corporate identity verification.'],
      ['Live OFAC, UN and EU sanctions feed',              'Seed list bundled',                            'Daily refresh from the Treasury, the UN and the European Commission endpoints.'],
      ['Real-time event-driven pipeline',                  'Batch with polling refresh',                   'Event-driven loop with Inngest or Temporal for sub-minute detection latency.'],
      ['Analyst feedback loop',                            'Not present',                                  'Thumbs up and thumbs down with reason tags feeding weekly precision reports and adjustable weights.'],
      ['SOC 2 Type II evidence collection',                'Deferred',                                     'Vanta or Drata wiring with a two-quarter observation period.'],
      ['Observability and tracing',                        'Platform-native logs',                         'OpenTelemetry tracing, Splunk or Elastic log export, Prometheus or Datadog metrics.'],
      ['UAE-sovereign hosting',                            'Data tier in Frankfurt (eu-central-1); Vercel app layer on global edge', 'Microsoft Azure UAE North or G42 Core42, subject to procurement.'],
      ['Vercel application region pin',                    'Global edge (pilot)',                          'Pinned to Frankfurt (fra1) via "regions": ["fra1"] in vercel.json at the same deploy as the UAE-sovereign migration.'],
      ['Penetration test and cryptographic audit',         'Not performed',                                'External vendor engagement before general availability rollout.'],
    ],
  ),
];

// ─── Section 15: Closing note ──────────────────────────────────────
// Note: the paragraph that contains the two long project URLs is rendered
// left-aligned rather than justified. A justified line that is forced to
// break before an unbreakable URL stretches inter-word spacing to fill the
// line, producing visible gaps. Left alignment keeps the spacing natural.
// keepNext on the penultimate paragraph keeps the single closing line from
// being orphaned on a page of its own.
const closing = [
  H1('15. Closing Note'),
  P([
    T('This document is a pilot delivery, not a commercial or regulatory submission. The work it describes is live today at '),
    new ExternalHyperlink({
      link: 'https://frontend-iota-seven-30.vercel.app',
      children: [new TextRun({ text: 'frontend-iota-seven-30.vercel.app', font: 'Cambria', size: 22, color: '1B4F72', underline: {} })],
    }),
    T(', and the full source code, including the one hundred and eighty-one test suite, is available for inspection at '),
    new ExternalHyperlink({
      link: 'https://github.com/AhmedRaoofuddin/Investment_UAE',
      children: [new TextRun({ text: 'github.com/AhmedRaoofuddin/Investment_UAE', font: 'Cambria', size: 22, color: '1B4F72', underline: {} })],
    }),
    T('. I have been careful to be concrete about what has been shipped and transparent about what has not. The honesty matters more than the marketing, because what the Ministry builds on top of this will be measured against both.'),
  ], { alignment: AlignmentType.LEFT }),
  P(T('If there are aspects of the platform the Ministry wishes to see demonstrated in greater depth, or reviewed by a specific team (security, data protection, procurement, investment operations), I would be glad to arrange that. The shortest path from this document to a decision is a live walk-through, and I would welcome the opportunity to give one. Once again, thank you for the opportunity to respond to this brief.'),
    { keepLines: true }),
];

// ─── Assemble the document ──────────────────────────────────────────
const doc = new Document({
  creator: 'Ahmed Raoofuddin',
  title: 'InvestUAE Signal Intelligence Pilot Delivery',
  description: 'Response to the Ministry of Investment AI Case Study',
  styles: {
    default: {
      document: { run: { font: 'Cambria', size: 22 } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cambria', size: 36, bold: true, color: NAVY },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cambria', size: 26, bold: true, color: NAVY },
        paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Cambria', size: 22, bold: true, color: NAVY_DARK },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
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
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: 'InvestUAE Signal Intelligence', font: 'Cambria', size: 18, color: INK_LIGHT }),
            new TextRun({ text: '\tMinistry of Investment Pilot Delivery', font: 'Cambria', size: 18, color: INK_LIGHT }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', font: 'Cambria', size: 18, color: INK_LIGHT }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Cambria', size: 18, color: INK_LIGHT }),
            new TextRun({ text: ' of ', font: 'Cambria', size: 18, color: INK_LIGHT }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Cambria', size: 18, color: INK_LIGHT }),
          ],
        })],
      }),
    },
    children: [
      ...cover,
      ...docControl,
      ...credentialsSec,
      ...toc,
      ...foreword,
      ...exec,
      ...context,
      ...interp,
      ...solution,
      ...walkthrough,
      ...bilingual,
      ...workspaceSec,
      ...architecture,
      ...agentsSec,
      ...pipelineSec,
      ...safetySec,
      ...dbSec,
      ...testingSec,
      ...deploy,
      ...future,
      ...closing,
    ],
  }],
});

const out = path.join(ROOT, 'InvestUAE_Signal_Intelligence_Delivery.docx');
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(out, buf);
console.log(`wrote ${out} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
