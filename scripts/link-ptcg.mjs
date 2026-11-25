// Relie chaque série anglaise de CardDex à son identifiant chez pokemontcg.io (API publique et gratuite).
// pokemontcg.io fournit pour chaque carte un lien de redirection vers sa page exacte sur Cardmarket :
//   https://prices.pokemontcg.io/cardmarket/<id de la carte>   (ex. sv3pt5-199)
// L'appli s'en sert pour le bouton Cardmarket (et TCGplayer en secours). Lancé chaque lundi avec les nouveautés.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data/catalog.json');
const catalog = JSON.parse(readFileSync(path, 'utf8'));
const r = await fetch('https://api.pokemontcg.io/v2/sets?pageSize=250');
if (!r.ok) throw new Error(`pokemontcg.io → HTTP ${r.status}`);
const ptcg = (await r.json()).data;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const day = (d) => String(d ?? '').replace(/\//g, '-').slice(0, 10);
const byName = new Map(ptcg.map((s) => [norm(s.name), s]));
let linked = 0;
for (const s of catalog.sets) {
  if (s.code.startsWith('J-') || !s.languages?.includes('en')) continue;
  const name = norm(s.nameEn ?? s.name);
  // même nom, sinon même date de sortie et même nombre de cartes imprimées
  const m = byName.get(name)
    ?? ptcg.find((p) => day(p.releaseDate) === day(s.releaseDate) && (p.printedTotal === s.official || norm(p.name).includes(name) || name.includes(norm(p.name))));
  if (m) { s.ptcg = m.id; linked++; } else delete s.ptcg;
}
writeFileSync(path, JSON.stringify(catalog));
console.log(`pokemontcg.io : ${linked} séries reliées sur ${catalog.sets.filter((s) => !s.code.startsWith('J-') && s.languages?.includes('en')).length}.`);
