// Importe (ou met à jour) les séries et cartes Pokémon depuis TCGdex (https://tcgdex.dev), base ouverte et gratuite.
// Trois éditions : français (fr), international (en) et japonais (ja).
//
// Usage :
//   node scripts/import-tcgdex.mjs                 mise à jour incrémentale (nouvelles séries / cartes seulement)
//   node scripts/import-tcgdex.mjs --full          revérifie toutes les cartes (raretés, illustrateurs, liens Cardmarket)
//   node scripts/import-tcgdex.mjs --langs fr,en   seulement certaines éditions
//   node scripts/import-tcgdex.mjs --limit 3       seulement les 3 séries les plus récentes par édition (essai rapide)
// Derrière un proxy : NODE_USE_ENV_PROXY=1 node scripts/import-tcgdex.mjs
//
// Les cartes françaises et internationales ont le même identifiant chez TCGdex (ex. sv03.5-151) : elles sont réunies
// en une seule fiche avec ses noms et images FR/EN. Les séries japonaises sont à part (préfixe « J- »).
// Les images ne sont pas copiées : l'appli les affiche directement depuis assets.tcgdex.net.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const FULL = args.includes('--full');
const LANGS = (opt('langs') ?? 'fr,en,ja').split(',');
const LIMIT = Number(opt('limit')) || 0;
const API = 'https://api.tcgdex.net/v2';
const SKIP_SERIES = new Set(['tcgp']); // Pokémon TCG Pocket (jeu mobile, pas de cartes physiques)
const CONCURRENCY = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${API}${path}`, { headers: { 'user-agent': 'CardDex (collection tracker)' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${path} : ${e.message}`);
      await sleep(1000 * 2 ** i);
    }
  }
}
async function pool(items, fn) {
  let i = 0, done = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const it = items[i++];
      try { await fn(it); } catch (e) { console.warn(`  ! ${e.message}`); }
      if (++done % 500 === 0) console.log(`  … ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

const catalogPath = join(root, 'data/catalog.json');
const old = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : { sets: [], cards: [], series: [] };
if (old.demo) { old.sets = []; old.cards = []; old.series = []; }
const sets = new Map(old.sets.map((s) => [s.code, s]));
const cards = new Map(old.cards.map((c) => [c.id, c]));
const series = new Map((old.series ?? []).map((s) => [s.id, s]));
const before = { sets: sets.size, cards: cards.size };

// clé de langue des champs : name (fr), nameEn, nameJa
const NAME = { fr: 'name', en: 'nameEn', ja: 'nameJa' };
const setCode = (lang, id) => (lang === 'ja' ? `J-${id}` : id);
const cardId = (lang, id) => (lang === 'ja' ? `J-${id}` : id);
const imgPath = (url, lang) => (url ? url.replace(`https://assets.tcgdex.net/${lang}/`, '') : null);

// Raretés : on garde les noms anglais de TCGdex comme clés ; les noms français connus sont ramenés à l'anglais.
const FR_RARITY = {
  Commune: 'Common', 'Peu Commune': 'Uncommon', Rare: 'Rare', 'Holo Rare': 'Rare Holo', 'Rare Holo': 'Rare Holo',
  'Double rare': 'Double rare', 'Ultra Rare': 'Ultra Rare', 'Illustration rare': 'Illustration rare',
  'Illustration spéciale rare': 'Special illustration rare', 'Hyper rare': 'Hyper rare', 'Magnifique rare': 'Amazing Rare',
  'Radieux Rare': 'Radiant Rare', Aucune: 'None',
};
const normRarity = (r) => (r ? FR_RARITY[r] ?? r : null);

const toDetail = [];
let newSets = 0;

for (const lang of LANGS) {
  console.log(`\n== Édition ${lang.toUpperCase()} ==`);
  let list = (await get(`/${lang}/sets`)) ?? [];
  const serieList = (await get(`/${lang}/series`)) ?? [];
  serieList.forEach((s, i) => {
    if (SKIP_SERIES.has(s.id)) return;
    const sid = lang === 'ja' ? `J-${s.id}` : s.id;
    const cur = series.get(sid) ?? { id: sid, order: i };
    cur[NAME[lang]] = s.name;
    cur.name ??= s.name;
    series.set(sid, cur);
  });
  if (LIMIT) list = list.slice(-LIMIT);
  console.log(`${list.length} séries chez TCGdex.`);
  await pool(list, async (brief) => {
    const code = setCode(lang, brief.id);
    const known = sets.get(code);
    const total = brief.cardCount?.total ?? 0;
    const haveAll = known && (known.langTotals?.[lang] ?? -1) === total;
    if (haveAll && !FULL) return;
    const s = await get(`/${lang}/sets/${encodeURIComponent(brief.id)}`);
    if (!s || SKIP_SERIES.has(s.serie?.id)) return;
    const serieId = lang === 'ja' ? `J-${s.serie?.id}` : s.serie?.id;
    const set = known ?? { code, tcgdex: s.id, block: serieId, languages: [] };
    if (!known) { newSets++; console.log(`  + ${code} « ${s.name} » (${total} cartes)`); }
    set[NAME[lang]] = s.name;
    set.name ??= s.name;
    set.block = serieId ?? set.block;
    set.releaseDate = s.releaseDate ?? set.releaseDate ?? null;
    set.official = s.cardCount?.official ?? set.official ?? null;
    set.print = s.abbreviation?.official ?? s.tcgOnline ?? set.print ?? null;
    if (s.logo) (set.logo ??= {})[lang] = s.logo;
    if (s.symbol) set.symbol = s.symbol;
    if (!set.languages.includes(lang)) set.languages.push(lang);
    (set.langTotals ??= {})[lang] = total;
    // chemin des images de la série (ex. « sv/sv03.5 ») déduit de la première carte illustrée
    const first = (s.cards ?? []).find((c) => c.image);
    if (first) (set.path ??= {})[lang] = imgPath(first.image, lang).split('/').slice(0, -1).join('/');
    sets.set(code, set);
    for (const b of s.cards ?? []) {
      const id = cardId(lang, b.id);
      const c = cards.get(id) ?? { id, set: code, number: b.localId, languages: [] };
      c[NAME[lang]] = b.name;
      c.name ??= b.name;
      if (!c.languages.includes(lang)) c.languages.push(lang);
      c.img = (c.img ?? []).filter((l) => l !== lang);
      if (b.image) {
        c.img.push(lang);
        const p = imgPath(b.image, lang);
        if (p !== `${set.path?.[lang]}/${b.localId}`) (c.imgPath ??= {})[lang] = p;
      }
      if (!c.img.length) delete c.img;
      cards.set(id, c);
      // détails (rareté, type, illustrateur, produit Cardmarket) : en anglais quand la carte existe en anglais
      if (FULL || c.rarity === undefined) toDetail.push([lang, b.id, id]);
    }
  });
}

// Détails : une requête par carte, seulement pour les nouvelles cartes (ou toutes avec --full).
const seen = new Set();
const jobs = toDetail
  .sort((a, b) => (a[0] === 'en' ? -1 : 0) - (b[0] === 'en' ? -1 : 0))
  .filter(([lang, , id]) => {
    if (seen.has(id)) return false;
    const c = cards.get(id);
    if (lang !== 'en' && c.languages.includes('en') && LANGS.includes('en')) return false; // fait en anglais
    seen.add(id); return true;
  });
console.log(`\nDétails de ${jobs.length} cartes…`);
const seeds = {};
await pool(jobs, async ([lang, tid, id]) => {
  const d = await get(`/${lang}/cards/${encodeURIComponent(tid)}`);
  if (!d) return;
  const c = cards.get(id);
  c.rarity = normRarity(d.rarity);
  c.type = d.category ?? null;              // Pokemon | Trainer | Energy
  c.color = d.types?.[0] ?? null;           // Fire, Water…
  if (d.illustrator) c.artist = d.illustrator; else delete c.artist;
  if (d.hp) c.hp = d.hp; else delete c.hp;
  if (d.stage) c.stage = d.stage; else delete c.stage;
  if (d.trainerType) c.sub = d.trainerType; else if (d.energyType) c.sub = d.energyType; else delete c.sub;
  if (d.dexId?.length) c.dex = d.dexId; else delete c.dex;
  const v = d.variants ?? {};
  c.variants = Object.keys(v).filter((k) => v[k]);
  if (!c.variants.length) delete c.variants;
  const cm = d.pricing?.cardmarket;
  if (cm?.idProduct) c.cardmarket = { idProduct: cm.idProduct };
  if (cm && (cm.trend || cm.avg)) seeds[id] = cm;
});

// Ordre : séries de la plus ancienne à la plus récente (l'appli affiche les plus récentes en tête)
const allSets = [...sets.values()].sort((a, b) => String(a.releaseDate ?? '9999').localeCompare(String(b.releaseDate ?? '9999')) || a.code.localeCompare(b.code));
allSets.forEach((s, i) => { s.order = i + 1; s.total = [...cards.values()].filter((c) => c.set === s.code).length; });
const allCards = [...cards.values()].filter((c) => sets.has(c.set));
const out = {
  demo: false, source: 'tcgdex.net', generatedAt: new Date().toISOString(),
  series: [...series.values()],
  sets: allSets,
  cards: allCards,
};
writeFileSync(catalogPath, JSON.stringify(out));

// Premiers prix : les moyennes Cardmarket fournies par TCGdex démarrent les courbes (l'historique est ensuite tenu par update-prices.mjs)
const seedPath = join(root, 'data/price-seeds.json');
if (Object.keys(seeds).length) {
  const prev = existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : {};
  writeFileSync(seedPath, JSON.stringify({ ...prev, ...seeds }));
}
console.log(`\nSéries : ${before.sets} → ${allSets.length} (${newSets} nouvelles). Cartes : ${before.cards} → ${allCards.length}.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Import TCGdex\n- Séries : ${before.sets} → ${allSets.length} (${newSets} nouvelles)\n- Cartes : ${before.cards} → ${allCards.length}\n`, { flag: 'a' });
}
