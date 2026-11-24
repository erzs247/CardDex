# CardDex – Collection Pokémon TCG

Appli web (installable sur téléphone) pour suivre sa collection de cartes **Pokémon**, sur le modèle de NightDex et de Pokécardex.

- **Trois éditions** (bouton FR | EN | JP) : française, internationale (anglais) et japonaise. Chaque édition a sa propre collection.
- **Accueil** : les séries regroupées par génération (Écarlate et Violet, Épée et Bouclier…), les plus récentes en tête, avec symbole, progression et favoris.
- **Série** : logo, trois affichages (Cartes, Liste, Grille), tri, filtres (possédées, manquantes, rareté), valeur de la série.
- **Fiche carte** : grande image, cote Cardmarket, prix minimum, moyennes 7 j et 30 j, **courbe de prix**, exemplaires (état, reverse), prix d'achat, vue 3D.
- **Listes** (façon Pokécardex) : chaque Pokémon toutes séries confondues, types, ex / V / VMAX / GX…, illustrations rares et spéciales, chromatiques, promos, illustrateurs.
- **Collection**, **Classeurs**, **Gradées**, **Cotes** (hausses / baisses), **Souhaits** (alertes prix, liste d'achat Cardmarket), **Scanner** de cartes.
- Comptes et amis (Firebase), optionnels.

Aucune dépendance côté appli : HTML, CSS et JavaScript.

## Données

- **Cartes et images : [TCGdex](https://tcgdex.dev)**, base ouverte et gratuite (FR, EN, JP). Les images s'affichent directement
  depuis `assets.tcgdex.net` : rien à stocker dans le dépôt.
- **Prix : Cardmarket** (guide des prix public, jeu n° 6). Chaque carte est rattachée à son produit Cardmarket par TCGdex.
  Les cartes japonaises n'ont en général pas de cote.

| Script | Rôle |
|---|---|
| `scripts/import-tcgdex.mjs` | séries et cartes FR / EN / JP (incrémental ; `--full` pour tout revérifier, `--limit 3` pour un essai) |
| `scripts/update-prices.mjs` | prix du jour → `data/prices.json` et historique → `data/history/<série>.json` |
| `scripts/make-scan-index.mjs` | empreintes du scanner → `data/scan/<édition>.json` |
| `scripts/make-demo.mjs` | petites données d'essai (série 151) |

## Mise en ligne (GitHub Pages) — à faire une fois

1. *Settings → Pages* : source **GitHub Actions**.
2. *Actions → « Prix Cardmarket, nouveautés et publication » → Run workflow*, cocher **nouveautés**.
   Le premier import télécharge toutes les cartes (≈ 1 h), puis relève les prix et publie le site.
3. Sur le téléphone : ouvrir `https://erzs247.github.io/carddex/` puis « Ajouter à l'écran d'accueil ».

Ensuite tout est automatique : prix chaque jour vers 7 h, nouvelles séries chaque lundi.

## Comptes (optionnel)

Comme NightDex, mais avec **un projet Firebase à part** (sinon les collections des deux applis se mélangeraient) :
créer le projet, activer Google + e-mail, ajouter `erzs247.github.io` aux domaines autorisés, créer Firestore,
coller `firestore.rules`, puis copier la configuration web dans `data/firebase.json`. Tant que ce fichier vaut `{}`,
l'appli marche sans comptes (collection sur l'appareil, export / import dans les Réglages).

## En veille

Repris de NightDex mais désactivés pour l'instant : créateur de decks (règles à refaire pour le Pokémon : 60 cartes,
4 exemplaires max), produits scellés, actualités, compagnon Capri (`DECKS_ON` / `PET_ON` en haut de `app.js`).

## Lancer en local

```bash
npm install
node scripts/import-tcgdex.mjs --limit 3   # ou node scripts/make-demo.mjs
npm start                                   # http://localhost:8080
```
