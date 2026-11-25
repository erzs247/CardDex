// Relève les prix Cardmarket du jour (guide des prix public publié chaque nuit ; Pokémon = jeu n° 6).
// Chaque carte est rattachée à son produit Cardmarket par TCGdex (idProduct, voir import-tcgdex.mjs).
//
// Usage :
//   node scripts/update-prices.mjs              télécharge le guide et met à jour data/prices.json + data/history/
//   node scripts/update-prices.mjs --dir ./cm   utilise un price_guide_6.json déjà téléchargé
//
// Fichiers écrits :
//  - data/prices.json : prix du jour de chaque carte (tendance, minimum, moyennes 1/7/30 j, reverse)
//  - data/history/<série>.json : historique des prix tendance, une série par fichier (chargé à la demande par l'appli)
// Une exécution par jour = un point de plus sur chaque courbe (la GitHub Action le fait toute seule).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const config = readJson('data/config.json');
const idGame = config.cardmarket.idGame;
const dir = opt('dir');

async function loadGuide() {
  if (dir) {
    const f = readdirSync(dir).find((n) => n.startsWith('price_guide') && n.endsWith('.json'));
    if (!f) throw new Error(`price_guide_*.json introuvable dans ${dir}`);
    return JSON.parse(readFileSync(join(dir, f), 'utf8'));
  }
  const url = config.cardmarket.priceGuideUrl.replace('{idGame}', idGame);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
// reverse / holo : « -foil » dans le guide Cardmarket, « -holo » chez TCGdex
const rev = (g, k) => num(g[`${k}-foil`]) ?? num(g[`${k}-holo`]);

const catalog = readJson('data/catalog.json');
const seeds = existsSync(join(root, 'data/price-seeds.json')) ? readJson('data/price-seeds.json') : {};
let guide = null;
try {
  const file = await loadGuide();
  guide = new Map(file.priceGuides.map((g) => [g.idProduct, g]));
  console.log(`Cardmarket : ${file.priceGuides.length} prix (guide du ${file.createdAt}).`);
} catch (e) {
  console.warn(`Guide Cardmarket indisponible (${e.message}) : prix de TCGdex seulement.`);
}

// Rattachement des cartes aux produits Cardmarket, à partir de la liste publique des produits.
// Un produit s'appelle « Rayquaza EX [Dragon Pulse | Dragon Burst] » : pas de numéro, et les versions d'une même carte
// (normale, pleine illustration, secrète…) portent le même nom. Dans une extension, Cardmarket les crée dans l'ordre
// des numéros : la n-ième version (par numéro de produit) va à la n-ième carte du même nom (par numéro de carte).
// L'extension d'une série vient des liens déjà fournis par TCGdex ; pour une série toute neuve sans lien, on prend
// l'extension libre dont les noms de cartes correspondent le mieux.
try {
  const r = dir ? null : await fetch(config.cardmarket.productsUrl.replace('{idGame}', idGame));
  const products = r?.ok ? (await r.json()).products : [];
  if (products.length) {
    const key = (n) => String(n ?? '').split(' [')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const expOf = new Map(products.map((p) => [p.idProduct, p.idExpansion]));
    const byExp = new Map();
    for (const p of products) { if (!byExp.has(p.idExpansion)) byExp.set(p.idExpansion, []); byExp.get(p.idExpansion).push(p); }
    const cardsBySet = new Map();
    for (const c of catalog.cards) if (!c.id.startsWith('J-')) { if (!cardsBySet.has(c.set)) cardsBySet.set(c.set, []); cardsBySet.get(c.set).push(c); }
    // extension de chaque série (vote des liens TCGdex)
    const setExp = new Map(), claimed = new Set();
    for (const [set, list] of cardsBySet) {
      const votes = new Map();
      for (const c of list) { const e = expOf.get(c.cardmarket?.idProduct); if (e) votes.set(e, (votes.get(e) ?? 0) + 1); }
      const best = [...votes].sort((x, y) => y[1] - x[1])[0];
      if (best) { setExp.set(set, best[0]); claimed.add(best[0]); }
    }
    for (const [set, list] of cardsBySet) {
      if (setExp.has(set) || list.length < 5) continue;
      const names = new Set(list.map((c) => key(c.nameEn ?? c.name)));
      let best = null, score = 0;
      for (const [e, ps] of byExp) {
        if (claimed.has(e)) continue;
        const hit = ps.filter((p) => names.has(key(p.name))).length / Math.max(ps.length, list.length);
        if (hit > score) { score = hit; best = e; }
      }
      if (best && score >= 0.6) { setExp.set(set, best); claimed.add(best); console.log(`Série ${set} reliée à l'extension Cardmarket ${best} (${Math.round(score * 100)} % des noms).`); }
    }
    const numKey = (n) => { const m = String(n).match(/^(\D*)(\d+)(.*)$/); return m ? [m[1], Number(m[2]), m[3]] : [String(n), 0, '']; };
    const byNumber = (a, b) => { const x = numKey(a.number), y = numKey(b.number); return x[0].localeCompare(y[0]) || x[1] - y[1] || x[2].localeCompare(y[2]); };
    let linked = 0, changed = 0;
    for (const [set, e] of setExp) {
      const groupsP = new Map(), groupsC = new Map();
      for (const p of byExp.get(e) ?? []) { const k = key(p.name); if (!groupsP.has(k)) groupsP.set(k, []); groupsP.get(k).push(p); }
      for (const c of cardsBySet.get(set)) { const k = key(c.nameEn ?? c.name); if (!groupsC.has(k)) groupsC.set(k, []); groupsC.get(k).push(c); }
      for (const [k, cs] of groupsC) {
        const ps = (groupsP.get(k) ?? []).sort((a, b) => a.idProduct - b.idProduct);
        if (!ps.length || ps.length !== cs.length) continue; // nombre de versions différent : on garde le lien TCGdex
        cs.sort(byNumber).forEach((c, i) => {
          const id = ps[i].idProduct;
          if (c.cardmarket?.idProduct !== id) changed++;
          c.cardmarket = { idProduct: id, idExpansion: e };
          linked++;
        });
      }
      // les autres cartes de la série gardent leur lien TCGdex, avec l'extension
      for (const c of cardsBySet.get(set)) if (c.cardmarket?.idProduct && !c.cardmarket.idExpansion) c.cardmarket.idExpansion = e;
    }
    writeFileSync(join(root, 'data/catalog.json'), JSON.stringify(catalog));
    console.log(`Cardmarket : ${setExp.size} séries reliées, ${linked} cartes rattachées par nom (${changed} liens corrigés).`);
  }
} catch (e) { console.warn(`Liste des produits Cardmarket indisponible (${e.message}).`); }

const histDir = join(root, 'data/history');
mkdirSync(histDir, { recursive: true });
const histories = new Map();
const histOf = (set) => {
  if (!histories.has(set)) {
    const p = join(histDir, `${set}.json`);
    histories.set(set, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
  }
  return histories.get(set);
};

// TCGdex rattache parfois plusieurs cartes d'une série au même produit Cardmarket (ex. la version normale et la
// version pleine illustration). Le produit est gardé pour la carte au plus petit numéro ; les autres n'ont pas de prix
// plutôt qu'un prix faux.
const num_ = (n) => parseInt(String(n).replace(/\D/g, ''), 10) || 0;
const owner = new Map();
for (const c of catalog.cards) {
  const id = c.cardmarket?.idProduct;
  if (!id) continue;
  const o = owner.get(id);
  if (!o || num_(c.number) < num_(o.number)) owner.set(id, c);
}
let shared = 0;
for (const c of catalog.cards) if (c.cardmarket?.idProduct && owner.get(c.cardmarket.idProduct) !== c) { c.cardmarket.shared = true; shared++; }
console.log(`${shared} cartes partagent le produit Cardmarket d'une autre carte : pas de prix pour elles.`);

// deuxième source : TCGplayer converti en euros (scripts/update-tcgplayer.mjs, chaque lundi)
const tcgFile = existsSync(join(root, 'data/tcgplayer.json')) ? readJson('data/tcgplayer.json') : {};
const tcg = tcgFile.prices ?? {}, tcgIds = tcgFile.ids ?? {};
const round = (v) => Math.round(v * 100) / 100;

const prices = {};
let priced = 0, mixed = 0;
for (const c of catalog.cards) {
  const tp = num(tcg[c.id]);
  const g = c.cardmarket?.shared ? null : guide?.get(c.cardmarket?.idProduct) ?? seeds[c.id];
  if (!g && !tp) continue;
  if (!g) {
    // seulement TCGplayer
    priced++;
    const hs = histOf(c.set);
    const h = (hs[c.id] ?? []).filter(([d]) => d !== today);
    h.push([today, tp]); hs[c.id] = h;
    prices[c.id] = { trend: null, cm: null, tcg: tp, ...(tcgIds[c.id] ? { tid: tcgIds[c.id] } : {}) };
    continue;
  }
  const holoOnly = !num(g.trend) && !num(g.avg) && !!rev(g, 'trend');
  const f = (k) => (holoOnly ? rev(g, k) : num(g[k]));
  let cm = f('trend') ?? f('avg') ?? f('low');
  // tendance aberrante (ex. 0,02 € pour une carte qui se vend 100 €) : on prend la médiane tendance / moy. 7 j / moy. 30 j
  const a7 = f('avg7'), a30 = f('avg30');
  if (cm != null && a7 != null && a30 != null && (cm > a30 * 4 || cm < a30 / 4)) cm = [cm, a7, a30].sort((x, y) => x - y)[1];
  if (cm == null && !tp) continue;
  priced++;
  // trend / cm = Cardmarket (éditions FR et JP) ; mix = moyenne Cardmarket + TCGplayer (édition EN, calculée dans l'appli)
  const trend = cm ?? null;
  if (cm != null && tp) mixed++;
  const p = { trend, cm, tcg: tp, mix: cm != null && tp ? round((cm + tp) / 2) : null, tid: tcgIds[c.id], low: f('low'), avg: f('avg'), avg1: f('avg1'), avg7: f('avg7'), avg30: f('avg30') };
  if (holoOnly) p.foil = true; else if (rev(g, 'trend')) p.trendFoil = rev(g, 'trend');
  for (const k of Object.keys(p)) if (p[k] == null) delete p[k];
  const hs = histOf(c.set);
  let h = hs[c.id] ?? [];
  if (!h.length) {
    if (p.avg30) h.push([daysAgo(30), p.avg30]);
    if (p.avg7) h.push([daysAgo(7), p.avg7]);
    // (pas de moyenne 1 j : sur une carte peu vendue, une seule vente la rend très éloignée du vrai prix)
  }
  // le premier mois, la courbe commence par les moyennes 30 j / 7 j / 1 j de Cardmarket (note sous le graphique)
  if (h.length < 34) p.seeded = true;
  h = h.filter(([d]) => d !== today);
  h.push([today, trend ?? tp]);
  hs[c.id] = h;
  prices[c.id] = p;
}
for (const [set, hs] of histories) writeFileSync(join(histDir, `${set}.json`), JSON.stringify(hs));
writeFileSync(join(root, 'data/prices.json'), JSON.stringify({ demo: false, source: 'Cardmarket', currency: 'EUR', updatedAt: today, split: true, prices }));
console.log(`${priced}/${catalog.cards.length} cartes avec un prix au ${today} (${mixed} en moyenne Cardmarket + TCGplayer).`);
