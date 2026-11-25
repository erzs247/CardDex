// Remet à plat l'historique des prix à partir des prix du jour (data/prices.json) :
// pour chaque carte, une courbe propre = moyenne 30 j et moyenne 7 j de Cardmarket, puis le prix du jour.
// Sert après une correction des rattachements Cardmarket, pour effacer les sauts faux (ex. 2 € → 200 € en un jour).
// Usage : node scripts/rebuild-history.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8'));
const { prices, updatedAt } = JSON.parse(readFileSync(join(root, 'data/prices.json'), 'utf8'));
const day = (n) => new Date(Date.parse(updatedAt) - n * 864e5).toISOString().slice(0, 10);
const dir = join(root, 'data/history');
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) rmSync(join(dir, f));
const bySet = new Map();
let n = 0;
for (const c of catalog.cards) {
  const p = prices[c.id];
  const now = p?.cm ?? p?.trend ?? p?.tcg;
  if (!now) continue;
  const h = [];
  if (p.cm != null && p.avg30) h.push([day(30), p.avg30]);
  if (p.cm != null && p.avg7) h.push([day(7), p.avg7]);
  h.push([updatedAt, now]);
  if (!bySet.has(c.set)) bySet.set(c.set, {});
  bySet.get(c.set)[c.id] = h;
  n++;
}
for (const [set, hs] of bySet) writeFileSync(join(dir, `${set}.json`), JSON.stringify(hs));
console.log(`Historique refait pour ${n} cartes (${bySet.size} séries).`);
