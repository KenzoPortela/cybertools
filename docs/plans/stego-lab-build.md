# Plan de build — Stego Lab : outils réutilisables & découpage

> Complète `stego-lab.md` (la conception). Ici : **quels outils/bibliothèques
> libres réutiliser**, et **comment découper l'implémentation en lots
> déployables**. **Rien n'est implémenté** tant que le découpage n'est pas validé.

## 1. Constat : le modèle CyberChef/IT-Tools ne se transpose pas tel quel

CyberChef et IT-Tools sont des applis web réutilisées **entières et non
modifiées**. Les outils de stégano de référence, eux, sont des **binaires
natifs** qui ne tournent pas dans un navigateur :

| Outil de référence | Langage | Réutilisable au navigateur ? |
|---|---|---|
| StegSolve | Java | Non — mais l'algo (plans de bits) est trivial à réécrire |
| zsteg | Ruby | Non — logique LSB réécrite en JS |
| steghide, outguess | C/C++ | Seulement via port **WASM** (lourd, phase ultérieure) |
| exiftool | Perl | Non — remplacé par une lib JS de métadonnées |
| binwalk | Python | Non — mini-version JS par table de signatures |
| Aperisolve | Python (orchestre les précédents) | Non — c'est l'idée qu'on reproduit |

**Stratégie hybride** (à valider) :

1. **Réutiliser des bibliothèques JS/WASM permissives** comme dépendances
   bundlées (métadonnées, inflate/zip, décodage d'images, QR…).
2. **Réécrire nous-mêmes les algorithmes pixel simples** (plans de bits, LSB,
   ELA, canaux, entropie) — c'est de l'arithmétique triviale, pas la peine d'une
   grosse dépendance, et ça colle à notre UI et à nos Web Workers.
3. **Réserver le portage WASM des binaires natifs** (steghide/outguess) à une
   phase ultérieure, optionnelle, chargée à la demande.

## 2. Compatibilité de licence (cybertools est GPL-3.0-only)

- **Compatibles** : MIT, Apache-2.0, BSD, ISC, LGPL, GPL-3.0, GPL-2.0-**or-later**.
- **Incompatibles** : GPL-2.0-**only** (ne peut pas être intégré à une œuvre
  GPL-3.0). À écarter.
- **Chaque licence ci-dessous est à revérifier au moment d'ajouter la
  dépendance** (versions, sous-dépendances). Rien n'est ajouté sans ce contrôle,
  et tout est bundlé — jamais chargé depuis un CDN (la CSP l'interdit).

## 3. Bibliothèques candidates (à confirmer avant ajout)

| Besoin | Candidat | Licence (à vérifier) | Décision |
|---|---|---|---|
| Métadonnées EXIF/IPTC/XMP/ICC/GPS | **exifr** | MIT | réutiliser |
| Repli métadonnées / TIFF | exif-reader, UTIF.js | MIT | secours |
| inflate / zip (zTXt, zip embarqué) | **fflate** | MIT | réutiliser |
| Signatures de fichiers (magic bytes) | **file-type** ou table maison | MIT | réutiliser/écrire |
| Décodage QR dans une image | **jsQR** | Apache-2.0 | réutiliser |
| Codes-barres élargis (option) | @zxing/library | Apache-2.0 | option |
| Décodage PNG hors navigateur (option) | fast-png | MIT | option |
| Décodage HEIC/AVIF (option, lourd) | libheif WASM | LGPL | phase ultérieure |
| steghide / outguess | port WASM | **GPL — à vérifier** | phase ultérieure, go/no-go |

À réécrire nous-mêmes (pas de dépendance) : plans de bits, extraction LSB, ELA,
séparation/rehaussement de canaux, carte d'entropie, `strings`, parseurs de
chunks PNG / segments JPEG, détection de données en fin de fichier.

Inspiration (non-dépendances) : **StegOnline** (stégano web open-source) pour
l'ergonomie ; **Aperisolve** pour le principe « tout d'un coup ».

## 4. Points d'intégration déjà repérés dans le code

- **Entrée catalogue** : `src/catalog/sources/native.ts` (même forme que
  `recipes`/`magic`), catégorie `forensics`, `layout: 'wide'`, renderer vue lazy.
- **Dépôt de fichier** : `CcInput.vue` expose déjà `InputFile { name, size,
  buffer }` (drag & drop + `<input file>`). Réutilisable / à adapter pour l'image.
- **Web Worker** : Vite gère `import Worker from './x?worker'` (déjà utilisé par
  Monaco). La CSP de prod autorise `worker-src 'self' blob:` et
  `wasm-unsafe-eval` — **à valider par un POC dès le lot 1 sur le conteneur**.
- **Sorties** : `output.ts` fournit `downloadBytes`, `formatBytes` (réutilisables
  pour exporter une image dérivée / un hexdump).
- **Passerelle Recettes** : `useRecipeStore().openWith(...)` (déjà utilisé par les
  opérations) pour « ouvrir la sortie extraite dans les Recettes ».
- **i18n** : `app.native.stegoLab.*` + espace `app.stego.*`, en + fr.

## 5. Découpage en lots (chacun testé et déployable)

Chaque lot = un commit (nom court, anglais), scénarios navigateur, contrôle
prod + conteneur, `vendor/` intact.

### Lot 1 — Squelette (aucune dépendance nouvelle)
- Entrée catalogue `stego-lab`, route `/tools/stego-lab`, aliases.
- `StegoLab.vue` : dépôt/collage d'image, décodage en `ImageData`
  (plein-res + aperçu borné), barre d'onglets (vide), état partagé.
- `StegoResultCanvas.vue` : rendu, zoom/pan, valeur du pixel survolé, export PNG.
- `stego-worker.ts` **vide mais câblé** (POC : un aller-retour worker) pour
  **prouver que la CSP du conteneur laisse tourner un worker Vite**.
- i18n de base, 1er scénario (`build/scenarios/stego.json`), fixtures minimales.
- *Commit suggéré : « Add Stego Lab skeleton ».*

### Lot 2 — Cœur pixel (réécrit, worker, sans dépendance)
- Plans de bits par canal (StegSolve), séparation/rehaussement de canaux
  (négatif, seuil, contraste, égalisation), carte d'entropie.
- *Commit : « Add stego bit-plane and channel views ».*

### Lot 3 — Métadonnées & structure (1res dépendances : exifr, fflate)
- Panneau métadonnées (EXIF/IPTC/XMP/ICC, GPS copiable).
- Inspecteur de structure : chunks PNG (dont tEXt/zTXt/iTXt), segments JPEG,
  **données en fin de fichier** + signatures (mini-binwalk), détection de
  polyglotte.
- *Commit : « Add stego metadata and structure inspector ».*

### Lot 4 — LSB + strings + passerelle Recettes
- Extraction LSB configurable (zsteg-like) → texte/hexdump + détection de
  fichier embarqué. `strings` filtrables. Bouton « ouvrir dans les Recettes ».
- *Commit : « Add stego LSB extraction and strings ».*

### Lot 5 — ELA + comparaison de deux images
- Error Level Analysis (ré-encodage JPEG en worker, OffscreenCanvas).
- Différence / XOR / superposition de deux images.
- *Commit : « Add stego ELA and image compare ».*

### Lot 6 — (BONUS conditionnel, reporté) extraction WASM
- **Décision (2026-09-20) : reporté.** On livre les lots 1–5 ; le lot 6 n'est
  rouvert que sur demande concrète *et* licence steghide confirmée compatible.
- Un **détecteur heuristique** léger (« ressemble-t-il à du steghide ? ») pourra
  couvrir une partie du besoin sans le poids, glissé au lot 4 si utile.
- *Commit : « Add stego native extraction (WASM) » — le jour venu.*

On reste en **beta v0.1.0**. Passage v0.2.0 envisageable après les lots 1–4.

## 6. Ce qui doit être tranché avant le lot 1

- **Feu vert sur la stratégie hybride** (réutiliser des libs JS + réécrire les
  algos simples + WASM plus tard) plutôt que « cloner un outil entier ».
- **POC CSP + worker** validé sur le conteneur dès le lot 1 (bloquant pour la
  suite).
- Bornes de taille d'image (surtout mobile).

## 7. Ce que je ferai à l'étape 1 (sur ton « go »)

Uniquement le **lot 1** : squelette visible et déployable, aucune dépendance
nouvelle, worker POC, premier scénario vert en dev, en prod et sur le conteneur.
Commit en ton nom, message court en anglais, sans signature. Je te présenterai
une capture avant de continuer au lot 2.
