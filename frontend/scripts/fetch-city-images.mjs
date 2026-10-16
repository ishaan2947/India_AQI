/**
 * Source one photograph per monitored city.
 *
 * The hero is "this city's own sky, graded by this city's own reading", which
 * needs thirty photographs, correctly attributed and all of the right place.
 *
 * The first version of this searched Commons full-text and took the best
 * scoring hit. It returned a sunflower for Lucknow, a kingfisher for
 * Ludhiana, a mausoleum in Bhopal for Patna, and a lake in Thailand for Surat
 * — because "Surat Thani" contains "Surat". Full-text search cannot promise
 * that a photograph is even of the right city.
 *
 * So the source of truth is Wikipedia instead: for each city, an ordered list
 * of articles about its landmarks. Every image in the "Hawa Mahal" article is
 * a picture of the Hawa Mahal — that is what an encyclopaedia article *is* —
 * and the lead image of one is usually the best photograph of it anyone has
 * contributed. Commons is still where the file and its licence metadata come
 * from; it is just no longer where the *judgement* comes from.
 *
 * What it does, per city:
 *   1. Walks that city's articles in order, pulling each one's media list.
 *   2. Rejects anything that isn't a usable modern landscape photograph —
 *      maps, flags, diagrams, engravings, pre-1990 archive scans, portraits,
 *      anything under 1600px wide or outside a sane aspect ratio — and
 *      anything whose filename names a *different* monitored city.
 *   3. Scores what's left: position in the article (the lead image counts for
 *      a lot), how close it is to the 16:9 the hero crops to, resolution, and
 *      words that suggest a vista rather than a storeroom.
 *   4. Downloads the winner and writes 900px and 1600px WebP renditions plus
 *      a 20px inline LQIP, exactly like the Taj hero.
 *   5. Records author, licence, licence URL and the Commons file page, because
 *      CC BY-SA requires it and it is the right thing to do regardless.
 *
 * Usage:
 *   node scripts/fetch-city-images.mjs              # fill in what's missing
 *   node scripts/fetch-city-images.mjs --force      # redo everything
 *   node scripts/fetch-city-images.mjs --only=Delhi,Pune
 *
 * It also writes city-images-review.html: a contact sheet of all thirty, so a
 * human can look at what the search actually picked. The filters can tell a
 * photograph from a diagram; they cannot tell a good photograph of Ranchi
 * from a dull one.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_DIR = path.join(ROOT, "public", "cities");
const MANIFEST = path.join(ROOT, "src", "data", "city-images.json");
const CITIES_JSON = path.join(ROOT, "src", "data", "cities-snapshot.json");

const UA =
  "India-AQI-site/1.0 (https://github.com/ishaan2947/India_AQI; ishaan2947@gmail.com)";

/**
 * Agra is not sourced: it keeps the Taj Mahal photograph the site was built
 * around. That frame is already colour-graded, cropped and processed to three
 * widths, its luma profile is what the hero's scrims were tuned against, and
 * it is the best picture on the site. Nothing a search returns will beat it.
 */
const AGRA = {
  slug: "hero-taj",
  src: "/hero-taj-1600.webp",
  srcSet:
    "/hero-taj-900.webp 900w, /hero-taj-1600.webp 1600w, /hero-taj-2400.webp 2400w",
  lqip: "data:image/webp;base64,UklGRogAAABXRUJQVlA4IHwAAAAwBACdASoUAA4APu1iqU2ppaQiMAgBMB2JZQCdIHGJ/gPIqRxGO8aH9MAA/pBJEzRVF/kVf/7/zNjPBFKJUtU9eR5QiCRHGlbjyvihAl8LDLineUeqP62eLTUiKs35uNuBhG3DTggWcc6HruTG/g3JAeMineKY/MUwwAAA",
  title: "The Taj Mahal at sunset, mirrored in its garden channel",
  artist: "Shan Elahi",
  license: "Unsplash License",
  licenseUrl: "https://unsplash.com/license",
  sourceUrl: "https://unsplash.com/photos/DDiLYt_F88w",
  source: "(kept by hand)",
  objectPosition: "center 58%",
};

/**
 * Wikipedia articles per city, best first.
 *
 * Hand-written, because this is the part of the job that needs to know
 * something: a reader in Jaipur recognises the Hawa Mahal, and the article
 * about it is full of photographs of it. Where a city has no famous landmark
 * article worth the name (Ludhiana, Meerut, Raipur), the city's own article
 * is listed and its cityscapes are used instead.
 */
const ARTICLES = {
  Ahmedabad: ["Sabarmati Riverfront", "Adalaj Stepwell", "Ahmedabad"],
  Amritsar: ["Golden Temple", "Amritsar", "Jallianwala Bagh"],
  Bangalore: ["Vidhana Soudha", "Bangalore Palace", "Lal Bagh", "Bangalore"],
  Bhopal: ["Upper Lake, Bhopal", "Taj-ul-Masajid", "Bhopal"],
  Chandigarh: [
    "Sukhna Lake",
    "Rock Garden of Chandigarh",
    "Capitol Complex, Chandigarh",
    "Chandigarh",
  ],
  Chennai: ["Marina Beach", "Chennai", "Kapaleeshwarar Temple"],
  Coimbatore: ["Coimbatore", "Marudamalai", "Perur Pateeswarar Temple"],
  Delhi: ["India Gate", "Humayun's Tomb", "Qutb Minar", "New Delhi"],
  Guwahati: ["Kamakhya Temple", "Saraighat Bridge", "Guwahati"],
  Hyderabad: ["Charminar", "Golconda Fort", "Hussain Sagar", "Hyderabad"],
  Indore: ["Rajwada", "Lal Bagh Palace", "Indore"],
  Jaipur: ["Hawa Mahal", "Amer Fort", "City Palace, Jaipur", "Jaipur"],
  Jodhpur: ["Mehrangarh", "Umaid Bhawan Palace", "Jodhpur"],
  Kanpur: ["Kanpur", "Kanpur Central railway station"],
  Kochi: ["Fort Kochi", "Chinese fishing nets", "Kochi"],
  Kolkata: ["Victoria Memorial, Kolkata", "Howrah Bridge", "Kolkata"],
  Lucknow: ["Bara Imambara", "Rumi Darwaza", "Lucknow"],
  Ludhiana: ["Ludhiana", "Punjab Agricultural University"],
  Meerut: ["Meerut", "Meerut Cantonment"],
  Mumbai: [
    "Marine Drive, Mumbai",
    "Gateway of India",
    "Chhatrapati Shivaji Maharaj Terminus",
    "Mumbai",
  ],
  Nagpur: ["Deekshabhoomi", "Zero Mile Stone", "Nagpur"],
  Patna: ["Golghar", "Patna", "Mahavir Mandir"],
  Pune: ["Shaniwar Wada", "Aga Khan Palace", "Pune"],
  Raipur: ["Nava Raipur", "Raipur"],
  Ranchi: ["Ranchi", "Hundru Falls", "Jagannath Temple, Ranchi"],
  Surat: ["Surat", "Surat Castle"],
  Vadodara: ["Laxmi Vilas Palace", "Vadodara", "Kirti Mandir, Vadodara"],
  Varanasi: ["Dashashwamedh Ghat", "Varanasi", "Kashi Vishwanath Temple"],
  Visakhapatnam: ["Kailasagiri", "Ramakrishna Beach", "Visakhapatnam"],
};

/** Every monitored city, for the "is this actually somewhere else?" check. */
const OTHER_CITIES = [
  "Agra", "Ahmedabad", "Amritsar", "Bangalore", "Bhopal", "Chandigarh",
  "Chennai", "Coimbatore", "Delhi", "Guwahati", "Hyderabad", "Indore",
  "Jaipur", "Jodhpur", "Kanpur", "Kochi", "Kolkata", "Lucknow", "Ludhiana",
  "Meerut", "Mumbai", "Nagpur", "Patna", "Pune", "Raipur", "Ranchi", "Surat",
  "Vadodara", "Varanasi", "Visakhapatnam",
];

// Not a photograph of a place as it looks today.
const BAD_TITLE =
  /(map|flag|seal|logo|coat.of.arms|montage|collage|locator|diagram|chart|poster|stamp|banner|plaque|signature|graph|statistics|painting|drawing|engraving|lithograph|sketch|portrait|emblem|crest)/i;

// Archive scans: a photograph of Patna in 1888 is a lovely thing and a
// terrible hero for a page about this afternoon's air.
const HISTORIC = /(1[0-9]{3}|200[0-5])/;

const MIN_WIDTH = 1600;
const MIN_RATIO = 1.3;
const MAX_RATIO = 2.6;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",")
  .map((s) => s.trim().toLowerCase());

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripHtml(value) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every image used in a Wikipedia article, in the order the article uses them
 * — so the infobox photograph, the one an editor chose to represent the
 * subject, comes first.
 */
async function articleImages(article) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(article)}`,
    { headers: { "User-Agent": UA } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items ?? [])
    .filter((item) => item.type === "image" && item.title)
    .map((item, position) => ({
      file: item.title.replace(/^File:/, ""),
      position,
    }));
}

/** Size, mime and licence for a batch of Commons files. */
async function commonsInfo(files) {
  if (files.length === 0) return new Map();
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: files.map((f) => `File:${f}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata|mime",
      format: "json",
    });

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons info failed: ${res.status}`);
  const json = await res.json();

  const out = new Map();
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const title = page.title.replace(/^File:/, "");
    out.set(title, {
      title,
      width: info.width,
      height: info.height,
      ratio: info.width / info.height,
      mime: info.mime,
      url: info.url,
      descriptionUrl: info.descriptionurl,
      artist: stripHtml(meta.Artist?.value) || "Unknown",
      license: stripHtml(meta.LicenseShortName?.value) || "see source",
      licenseUrl: stripHtml(meta.LicenseUrl?.value) || "",
      credit: stripHtml(meta.ObjectName?.value) || "",
    });
  }
  return out;
}

// Words that mark the kind of frame that makes a good full-bleed hero, and
// words that mark the kind that doesn't.
const GOOD_WORDS =
  /(sunset|sunrise|skyline|panorama|panoramic|aerial|dusk|evening|night|golden|view|overlook|riverfront|waterfront|lake|ghat|fort|palace|temple|bridge|facade|exterior)/i;
const MEH_WORDS =
  /(interior|interni|interno|intérieur|innen|inside|closeup|close-up|detail|ceiling|roof|floor|staircase|corridor|museum|under construction|parking|workshop|office|platform|bus stand|shop|plan|model|replica|grave|tomb of|cow|bird|flower|food|dish)/i;

/**
 * How good a hero would this make?
 *
 * "Aesthetically pleasing" is not a field any API returns, so this stands in
 * for it: the article's own lead image counts for a lot (an editor already
 * made this judgement), a wide 16:9-ish frame counts (that is the shape the
 * hero crops to — a portrait photo of a temple becomes a crop of a doorway),
 * resolution counts a little, and a title that sounds like a vista beats one
 * that sounds like a storeroom.
 */
function score(candidate, position) {
  let value = 60 - position * 12; // the editor's lead image, emphatically first
  value += Math.min(candidate.width / 150, 28);
  value -= Math.abs(candidate.ratio - 1.78) * 30;
  if (GOOD_WORDS.test(candidate.title)) value += 16;
  if (MEH_WORDS.test(candidate.title)) value -= 34;
  if (/jpe?g/i.test(candidate.mime)) value += 4;
  return value;
}

function usable(candidate, city) {
  if (!candidate) return false;
  if (!/jpeg|png/.test(candidate.mime)) return false;
  if (candidate.width < MIN_WIDTH) return false;
  if (candidate.ratio < MIN_RATIO || candidate.ratio > MAX_RATIO) return false;
  if (BAD_TITLE.test(candidate.title)) return false;
  if (HISTORIC.test(candidate.title)) return false;
  // "Mausoleum of Dost Khan Bhopal" is not a photograph of Patna.
  const mentionsElsewhere = OTHER_CITIES.some(
    (other) =>
      other !== city &&
      new RegExp(`\b${other}\b`, "i").test(candidate.title),
  );
  if (mentionsElsewhere) return false;
  return true;
}

/**
 * Walk the city's articles in order and return the best usable photograph
 * from the first one that has any.
 */
async function pickFor(city) {
  for (const article of ARTICLES[city] ?? [city]) {
    const listed = await articleImages(article);
    if (listed.length === 0) {
      process.stdout.write(`    "${article}" — no media
`);
      continue;
    }

    const info = await commonsInfo(listed.slice(0, 40).map((l) => l.file));
    const scored = listed
      .map((l) => {
        const candidate = info.get(l.file.replace(/_/g, " ")) ?? info.get(l.file);
        if (!usable(candidate, city)) return null;
        return { ...candidate, article, score: score(candidate, l.position) };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) return scored[0];
    process.stdout.write(`    "${article}" — nothing usable
`);
  }
  return null;
}

/** Keep any single hero under this, so a city swap is never a long wait. */
const MAX_HERO_KB = 240;

/**
 * Captions the generator can't derive.
 *
 * A filename like "PERUR PATTEESHWARAR TEMPLE.jpg" or "Mustafa Castle --
 * night shot.jpg" needs a person, not a regex. Everything not listed here is
 * named from its Wikipedia article, which is usually right.
 */
const CAPTION_OVERRIDES = {
  Coimbatore: "Perur Pateeswarar Temple, Coimbatore",
  Kanpur: "Kanpur Central railway station",
  Kochi: "Chinese fishing nets, Fort Kochi",
  Ludhiana: "Punjab Agricultural University, Ludhiana",
  Meerut: "Mustafa Castle, Meerut",
  Raipur: "Nava Raipur, the new capital district",
  Ranchi: "Gonda Hill suspension bridge, Ranchi",
  Surat: "Surat Diamond Bourse",
};

/**
 * A caption a person would write, from a filename a camera wrote.
 *
 * Commons filenames are "The_Golden_Temple_of_Amrithsar_7.jpg" — underscores,
 * sequence numbers, the occasional typo. The article the photograph came from
 * is a better name for the subject than its filename is, so prefer that, and
 * fall back to a tidied filename when the article *is* the city (in which
 * case the filename usually names the specific place).
 */
function captionFor(city, article, fileTitle) {
  if (CAPTION_OVERRIDES[city]) return CAPTION_OVERRIDES[city];
  const cleaned = fileTitle
    .replace(/\.(jpe?g|png)$/i, "")
    .replace(/_/g, " ")
    .replace(/\s*[-–]\s*\d+$/, "")   // trailing "- 9305"
    .replace(/\s+\d{2,}$/, "")        // trailing "7" / "01"
    .replace(/\s*\(.*?\)\s*$/, "")  // trailing "(cropped)"
    .replace(/\s+/g, " ")
    .trim();

  if (article.toLowerCase() === city.toLowerCase()) return cleaned;
  // "Victoria Memorial, Kolkata" is already of the form we want.
  if (article.toLowerCase().includes(city.toLowerCase())) return article;
  return `${article}, ${city}`;
}

async function renderVariants(buffer, slug) {
  const base = sharp(buffer).rotate(); // honour EXIF orientation

  // A detailed panorama at q72 can be 400KB+, which is a visible pause on a
  // phone when the reader switches city. Step the quality down until it fits
  // the budget rather than shipping one outlier that spoils the interaction.
  //
  // The low end of this ladder is less brutal than it sounds: every one of
  // these photographs is shown under a haze layer and two scrims, so the fine
  // detail that a high-quality WebP is protecting is half-hidden anyway.
  let rendered = null;
  for (const quality of [72, 64, 56, 48, 40, 34]) {
    rendered = await base
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (rendered.length <= MAX_HERO_KB * 1024) break;
  }
  await writeFile(path.join(OUT_DIR, `${slug}-1600.webp`), rendered);

  await base
    .clone()
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 68 })
    .toFile(path.join(OUT_DIR, `${slug}-900.webp`));

  // The inline placeholder: 20px wide, so it is a couple of hundred bytes and
  // paints on the first frame while the real file decodes.
  const lqip = await base
    .clone()
    .resize({ width: 20 })
    .webp({ quality: 40 })
    .toBuffer();

  return `data:image/webp;base64,${lqip.toString("base64")}`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const cities = JSON.parse(await readFile(CITIES_JSON, "utf8")).map(
    (c) => c.name,
  );

  let manifest = {};
  if (existsSync(MANIFEST)) {
    manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  }

  for (const city of cities) {
    if (ONLY && !ONLY.includes(city.toLowerCase())) continue;
    const slug = slugify(city);

    if (city === "Agra") {
      manifest[city] = AGRA;
      console.log("· Agra — keeping the Taj Mahal photograph");
      continue;
    }

    if (!FORCE && manifest[city] && existsSync(path.join(OUT_DIR, `${slug}-1600.webp`))) {
      console.log(`· ${city} — already have one`);
      continue;
    }

    console.log(`→ ${city}`);
    try {
      const pick = await pickFor(city);
      if (!pick) {
        console.log(`  ✗ nothing usable found`);
        continue;
      }

      const res = await fetch(pick.url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`download failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const lqip = await renderVariants(buffer, slug);

      manifest[city] = {
        slug,
        src: `/cities/${slug}-1600.webp`,
        srcSet: `/cities/${slug}-900.webp 900w, /cities/${slug}-1600.webp 1600w`,
        lqip,
        // Everything the licence requires, plus what the picture is of.
        title: captionFor(city, pick.article, pick.title),
        fileTitle: pick.title,
        artist: pick.artist,
        license: pick.license,
        licenseUrl: pick.licenseUrl,
        sourceUrl: pick.descriptionUrl,
        source: pick.article,
        // Where to anchor the crop. Cityscapes sit low in frame more often
        // than not; override per city in the JSON if one looks wrong.
        objectPosition: "center 50%",
      };

      console.log(
        `  ✓ ${pick.width}×${pick.height} [${pick.license}] via "${pick.article}" — ${pick.title.slice(0, 52)}`,
      );
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
    }
  }

  // Stable key order keeps the diff readable when one city is refreshed.
  const ordered = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((k) => [k, manifest[k]]),
  );
  await writeFile(MANIFEST, JSON.stringify(ordered, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${Object.keys(ordered).length} entries to src/data/city-images.json`);

  await writeReviewSheet(ordered);
}

/**
 * A contact sheet of every pick, because the filters above can tell a
 * photograph from a diagram but not a good photograph from a dull one.
 */
async function writeReviewSheet(manifest) {
  const cards = Object.entries(manifest)
    .map(
      ([city, m]) => `
    <figure>
      <img src="public${m.src.replace("-1600", "-900")}" alt="${city}" loading="lazy">
      <figcaption>
        <strong>${city}</strong>
        <span>${m.title}</span>
        <span>${m.artist} · ${m.license}${m.curatedTier ? " · Commons Quality image" : ""}</span>
        <a href="${m.sourceUrl}" target="_blank" rel="noreferrer">source</a>
        <code>--only=${city}</code>
      </figcaption>
    </figure>`,
    )
    .join("");

  const html = `<!doctype html><meta charset="utf-8"><title>City image review</title>
<style>
  body{background:#0c0b0a;color:#efeae4;font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px}
  h1{font-size:18px;margin:0 0 4px}
  p{color:#8a837a;margin:0 0 24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
  figure{margin:0;background:#131110;border:1px solid #302b28}
  img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
  figcaption{padding:8px 10px;display:grid;gap:2px;font-size:12px}
  figcaption span{color:#8a837a}
  code{color:#cbb08b;font-size:11px}
  a{color:#b3aba2}
</style>
<h1>City images — ${Object.keys(manifest).length} picks</h1>
<p>Anything that looks wrong: re-run with the <code>--only=City</code> shown under it, or edit its search terms in scripts/fetch-city-images.mjs.</p>
<div class="grid">${cards}</div>`;

  await writeFile(path.join(ROOT, "city-images-review.html"), html, "utf8");
  console.log("Review sheet: frontend/city-images-review.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
