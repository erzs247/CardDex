// Deuxième source de prix : TCGplayer (marché américain), fournie par TCGdex dans la fiche de chaque carte anglaise.
// Converti en euros au cours du jour de la Banque centrale européenne, puis mêlé à la cote Cardmarket par update-prices.mjs.
// Une requête par carte : lancé chaque lundi (ou à la demande), pas chaque jour.
// Usage : node scripts/update-tcgplayer.mjs [--limit 500]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const catalog = JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8'));
const outPath = join(root, 'data/tcgplayer.json');
const old = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { prices: {} };

// cours USD → EUR (BCE)
let usdPerEur = old.usdPerEur ?? 1.08;
try {
  const xml = await (await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml')).text();
  const m = xml.match(/currency='USD' rate='([\d.]+)'/);
  if (m) usdPerEur = Number(m[1]);
} catch (e) { console.warn(`Cours BCE indisponible (${e.message}), on garde ${usdPerEur}.`); }

const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);
// prix de référence TCGplayer : « market price » de la version normale, sinon holo, sinon reverse, sinon la première trouvée
function pick(tp) {
  if (!tp || typeof tp !== 'object') return null;
  const order = ['normal', 'holofoil', 'holo', 'unlimited', 'unlimitedHolofoil', '1stEdition', '1stEditionHolofoil', 'reverse-holofoil', 'reverseHolofoil', 'reverse'];
  const variants = Object.keys(tp).filter((k) => tp[k] && typeof tp[k] === 'object');
  for (const k of [...order.filter((o) => variants.includes(o)), ...variants]) {
    const v = tp[k];
    const p = num(v.marketPrice) ?? num(v.midPrice) ?? num(v.lowPrice);
    if (p) return p;
  }
  return null;
}

const todo = catalog.cards.filter((c) => c.languages?.includes('en') && !c.id.startsWith('J-')).slice(0, limit);
console.log(`TCGplayer : ${todo.length} cartes anglaises à relever (1 $ = ${(1 / usdPerEur).toFixed(4)} €).`);
const prices = {};
let i = 0, found = 0, done = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < todo.length) {
    const c = todo[i++];
    for (let t = 0; t < 3; t++) {
      try {
        const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(c.id)}`);
        if (r.status === 404) break;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const usd = pick(d.pricing?.tcgplayer);
        if (usd) { prices[c.id] = Math.round((usd / usdPerEur) * 100) / 100; found++; }
        break;
      } catch { await new Promise((res) => setTimeout(res, 1000 * 2 ** t)); }
    }
    if (++done % 2000 === 0) console.log(`  … ${done}/${todo.length}`);
  }
}));
// une carte sans relevé cette semaine garde son ancien prix (s'il existe)
for (const [id, v] of Object.entries(old.prices ?? {})) if (!(id in prices) && catalog.cards.some((c) => c.id === id)) prices[id] = v;
writeFileSync(outPath, JSON.stringify({ source: 'TCGplayer via TCGdex', currency: 'EUR', usdPerEur, updatedAt: new Date().toISOString().slice(0, 10), prices }));
console.log(`TCGplayer : ${found} prix relevés, ${Object.keys(prices).length} au total.`);
