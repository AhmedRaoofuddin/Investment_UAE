"use client";

import Image from "next/image";

// Each source ships its own brand icon so the marquee shows real publisher
// marks rather than a generic diamond bullet. The PNG/JPEG assets live in
// /public/sources/ — most are 32–180 px (apple-touch-icon scrapes); a few of
// the smaller news brands only expose 16 px favicons but render acceptably
// at h-7 inside the white tile because of the upscale-with-padding.
//
// `name` is the canonical display label (kept brief — they sit on a busy
// scrolling track). `domain` is shown in tiny text so users can identify the
// source even when they don't recognise the logo.
interface Source {
  name: string;
  domain: string;
  // Path under /public — defaults to /sources/<slug>.png when omitted.
  icon?: string;
}

const SOURCES: Source[] = [
  { name: "Wamda", domain: "wamda.com", icon: "/sources/wamda.png" },
  { name: "MAGNiTT", domain: "magnitt.com", icon: "/sources/magnitt.png" },
  { name: "MENAbytes", domain: "menabytes.com", icon: "/sources/menabytes.png" },
  { name: "The National Business", domain: "thenationalnews.com", icon: "/sources/the-national.jpeg" },
  { name: "Khaleej Times", domain: "khaleejtimes.com", icon: "/sources/khaleej-times.png" },
  { name: "Gulf News", domain: "gulfnews.com", icon: "/sources/gulf-news.png" },
  { name: "Arabian Business", domain: "arabianbusiness.com", icon: "/sources/arabian-business.png" },
  { name: "Gulf Business", domain: "gulfbusiness.com", icon: "/sources/gulf-business.png" },
  { name: "Zawya · LSEG", domain: "zawya.com", icon: "/sources/zawya.png" },
  { name: "Fast Company ME", domain: "fastcompanyme.com", icon: "/sources/fast-company-me.png" },
  { name: "Economy Middle East", domain: "economymiddleeast.com", icon: "/sources/economy-me.png" },
  { name: "Reuters Business", domain: "reuters.com", icon: "/sources/reuters.png" },
  { name: "TechCrunch", domain: "techcrunch.com", icon: "/sources/techcrunch.png" },
  { name: "Sifted", domain: "sifted.eu", icon: "/sources/sifted.png" },
  { name: "Crunchbase News", domain: "crunchbase.com", icon: "/sources/crunchbase.png" },
  { name: "VentureBeat", domain: "venturebeat.com", icon: "/sources/venturebeat.png" },
];

export function SourceMarquee() {
  // Duplicate the list so the CSS `marquee-track` keyframe can scroll one full
  // length and reset without a visible seam.
  const items = [...SOURCES, ...SOURCES];

  return (
    <section className="border-y border-line bg-navy-900 overflow-hidden">
      <div className="py-6 md:py-7 relative">
        {/* Edge fades to soften where logos enter/exit the viewport. */}
        <div className="absolute inset-y-0 left-0 w-24 md:w-32 bg-gradient-to-r from-navy-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 md:w-32 bg-gradient-to-l from-navy-900 to-transparent z-10 pointer-events-none" />

        <div className="marquee-track whitespace-nowrap">
          {items.map((s, i) => (
            <a
              key={`${s.domain}-${i}`}
              href={`https://${s.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              // Uses inline-flex (not block) so the children sit on the
              // marquee's single horizontal line. mx- spacing controls the
              // visible gap between brands.
              className="inline-flex items-center gap-3 mx-6 md:mx-8 group align-middle"
              aria-label={`${s.name} · ${s.domain}`}
            >
              {/* White tile gives every favicon a consistent neutral background
                  so dark-on-transparent marks remain legible against navy. */}
              <span className="inline-flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-[4px] bg-white shadow-sm shrink-0 overflow-hidden">
                <Image
                  src={s.icon!}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="w-7 h-7 md:w-8 md:h-8 object-contain"
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12.5px] md:text-[13px] uppercase tracking-[0.18em] text-navy-100 font-semibold group-hover:text-white transition-colors">
                  {s.name}
                </span>
                <span className="text-[10px] tracking-wider text-navy-300/70 font-normal lowercase">
                  {s.domain}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
