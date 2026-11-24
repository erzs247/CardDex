// Données d'essai (avant le premier import TCGdex) : la série 151 en FR/EN (numéros = Pokédex) et un extrait japonais.
// Pas de prix ni de raretés : tout arrive avec « node scripts/import-tcgdex.mjs » puis « node scripts/update-prices.mjs ».
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FR = 'Bulbizarre Herbizarre Florizarre Salamèche Reptincel Dracaufeu Carapuce Carabaffe Tortank Chenipan Chrysacier Papilusion Aspicot Coconfort Dardargnan Roucool Roucoups Roucarnage Rattata Rattatac Piafabec Rapasdepic Abo Arbok Pikachu Raichu Sabelette Sablaireau Nidoran♀ Nidorina Nidoqueen Nidoran♂ Nidorino Nidoking Mélofée Mélodelfe Goupix Feunard Rondoudou Grodoudou Nosferapti Nosferalto Mystherbe Ortide Rafflesia Paras Parasect Mimitoss Aéromite Taupiqueur Triopikeur Miaouss Persian Psykokwak Akwakwak Férosinge Colossinge Caninos Arcanin Ptitard Têtarte Tartard Abra Kadabra Alakazam Machoc Machopeur Mackogneur Chétiflor Boustiflor Empiflor Tentacool Tentacruel Racaillou Gravalanch Grolem Ponyta Galopa Ramoloss Flagadoss Magnéti Magnéton Canarticho Doduo Dodrio Otaria Lamantine Tadmorv Grotadmorv Kokiyas Crustabri Fantominus Spectrum Ectoplasma Onix Soporifik Hypnomade Krabby Krabboss Voltorbe Électrode Noeunoeuf Noadkoko Osselait Ossatueur Kicklee Tygnon Excelangue Smogo Smogogo Rhinocorne Rhinoféros Leveinard Saquedeneu Kangourex Hypotrempe Hypocéan Poissirène Poissoroy Stari Staross M.Mime Insécateur Lippoutou Élektek Magmar Scarabrute Tauros Magicarpe Léviator Lokhlass Métamorph Évoli Aquali Voltali Pyroli Porygon Amonita Amonistar Kabuto Kabutops Ptéra Ronflex Artikodin Électhor Sulfura Minidraco Draco Dracolosse Mewtwo Mew'.split(' ');
const EN = 'Bulbasaur Ivysaur Venusaur Charmander Charmeleon Charizard Squirtle Wartortle Blastoise Caterpie Metapod Butterfree Weedle Kakuna Beedrill Pidgey Pidgeotto Pidgeot Rattata Raticate Spearow Fearow Ekans Arbok Pikachu Raichu Sandshrew Sandslash Nidoran♀ Nidorina Nidoqueen Nidoran♂ Nidorino Nidoking Clefairy Clefable Vulpix Ninetales Jigglypuff Wigglytuff Zubat Golbat Oddish Gloom Vileplume Paras Parasect Venonat Venomoth Diglett Dugtrio Meowth Persian Psyduck Golduck Mankey Primeape Growlithe Arcanine Poliwag Poliwhirl Poliwrath Abra Kadabra Alakazam Machop Machoke Machamp Bellsprout Weepinbell Victreebel Tentacool Tentacruel Geodude Graveler Golem Ponyta Rapidash Slowpoke Slowbro Magnemite Magneton Farfetch’d Doduo Dodrio Seel Dewgong Grimer Muk Shellder Cloyster Gastly Haunter Gengar Onix Drowzee Hypno Krabby Kingler Voltorb Electrode Exeggcute Exeggutor Cubone Marowak Hitmonlee Hitmonchan Lickitung Koffing Weezing Rhyhorn Rhydon Chansey Tangela Kangaskhan Horsea Seadra Goldeen Seaking Staryu Starmie Mr.Mime Scyther Jynx Electabuzz Magmar Pinsir Tauros Magikarp Gyarados Lapras Ditto Eevee Vaporeon Jolteon Flareon Porygon Omanyte Omastar Kabuto Kabutops Aerodactyl Snorlax Articuno Zapdos Moltres Dratini Dragonair Dragonite Mewtwo Mew'.split(' ');
const fix = (n) => n.replace('M.Mime', 'M. Mime').replace('Mr.Mime', 'Mr. Mime');
const pad = (n) => String(n).padStart(3, '0');
const cards = FR.map((n, i) => ({ id: `sv03.5-${pad(i + 1)}`, set: 'sv03.5', number: pad(i + 1), name: fix(n), nameEn: fix(EN[i]), languages: ['fr', 'en'], img: ['fr', 'en'], type: 'Pokemon', dex: [i + 1] }));
const JA = [['001', 'フシギダネ'], ['004', 'ヒトカゲ'], ['006', 'リザードン'], ['007', 'ゼニガメ'], ['025', 'ピカチュウ'], ['133', 'イーブイ'], ['143', 'カビゴン'], ['150', 'ミュウツー'], ['151', 'ミュウ']];
for (const [n, name] of JA) cards.push({ id: `J-SV2a-${n}`, set: 'J-SV2a', number: n, name, nameJa: name, languages: ['ja'], img: ['ja'], type: 'Pokemon' });
const catalog = {
  demo: true, source: 'demo', generatedAt: new Date().toISOString(),
  series: [{ id: 'sv', name: 'Écarlate et Violet', nameEn: 'Scarlet & Violet', order: 1 }, { id: 'J-SV', name: 'Scarlet & Violet (JP)', nameJa: 'スカーレット&バイオレット', order: 2 }],
  sets: [
    { code: 'sv03.5', tcgdex: 'sv03.5', block: 'sv', name: '151', nameEn: '151', print: 'MEW', releaseDate: '2023-09-22', official: 165, languages: ['fr', 'en'], path: { fr: 'sv/sv03.5', en: 'sv/sv03.5' }, order: 2, total: 151 },
    { code: 'J-SV2a', tcgdex: 'SV2a', block: 'J-SV', name: 'ポケモンカード151', nameJa: 'ポケモンカード151', print: 'SV2a', releaseDate: '2023-06-16', official: 165, languages: ['ja'], path: { ja: 'SV/SV2a' }, order: 1, total: JA.length },
  ],
  cards,
};
writeFileSync(join(root, 'data/catalog.json'), JSON.stringify(catalog));
writeFileSync(join(root, 'data/prices.json'), JSON.stringify({ demo: true, source: 'Cardmarket', currency: 'EUR', updatedAt: null, split: true, prices: {} }));
console.log(`Données d'essai : ${cards.length} cartes.`);
