# Plan — Stego Lab : expansion vers « le meilleur outil de stégano gratuit »

> Suite de `stego-lab.md` / `stego-lab-build.md`. Lots 1–5 livrés (10 onglets).
> Ici : viser la parité **puis dépasser** Aperisolve / StegSolve / StegOnline /
> zsteg, **et** ajouter un module pour *cacher* des données. **Rien n'est
> implémenté** tant que ce plan n'est pas validé.

## 1. Le constat, encore plus qu'au lot 6

Aperisolve est une **interface web mince par-dessus des binaires natifs** lancés
côté serveur : zsteg (Ruby), steghide/outguess (C++), binwalk/foremost/pcrt
(Python), pngcheck (C), identify (ImageMagick, C), openstego (Java), exiftool
(Perl). Il **téléverse ton image** sur son serveur pour les faire tourner.

cybertools est **100 % navigateur, zéro requête** (CSP `connect-src 'self'`).
On ne peut donc pas « ajouter » ces binaires. Mais — et c'est la bonne nouvelle
— **la quasi-totalité de leur *analyse* se réécrit en JavaScript**, souvent en
**mieux** : interactif, instantané, et **sans jamais envoyer l'image**. C'est
précisément l'argument qui peut rendre cybertools meilleur qu'Aperisolve : même
puissance, sans la fuite de données.

**Faisabilité par fonction Aperisolve :**

| Fonction Aperisolve | Nature | Chez nous |
|---|---|---|
| Color remapping | pixels | **[nav]** réécrire — permutations de canaux, fausses couleurs, palettes |
| Visuels par couleur (R/G/B) | plans de bits | **[nav]** grille de plans par canal (déjà le cœur au lot 2) |
| Superposé | combinaison de plans | **[nav]** |
| Infos image | métadonnées + stats | **[nav]** dimensions, format, hash, stats par canal |
| binwalk | signatures + extraction | **[nav]** scan complet + carving + détection de flux zlib |
| foremost | carving par en-tête/pied | **[nav]** carver maison (jpg/png/zip/gz/pdf/gif) |
| pngcheck | validation PNG | **[nav]** chunks, CRC, interprétation, erreurs |
| pcrt | réparation PNG | **[nav]** (sous-ensemble) CRC, IHDR, signature |
| identify (ImageMagick) | stats image | **[nav]** géométrie, profondeur, stats par canal |
| zsteg | brute LSB + détection | **[nav]** mode auto multi-config + détection |
| strings | chaînes | **[nav] déjà fait (lot 4)** |
| exiftool (lecture) | métadonnées | **[nav] déjà fait (lot 3)** |
| **Éditeur EXIF/métadonnées** | écriture | **[nav]** piexifjs (JPEG) + chunks PNG maison |
| openstego / steghide (extraction) | crypto + format | **[wasm] / reporté** — seuls vrais bloqueurs |
| **Cacher des données** (nouveau) | LSB, texte, EOF, méta | **[nav]** notre propre encodeur multi-méthodes |

**Conclusion : on ne « wrappe » pas des outils, on réimplémente leur analyse
nativement.** Seule l'extraction steghide/openstego reste native (WASM ou
reportée) — et on la remplace en partie par **notre propre encodeur/décodeur**
interopérable avec lui-même.

## 2. Principes (inchangés)

- **100 % local, zéro requête.** Dépendances pures/bundlées, MIT/Apache/BSD/LGPL
  ou GPL-compatibles, licence vérifiée avant tout ajout.
- **`vendor/` intact.** Tout dans `src/integrations/stego/`.
- **Pixel lourd dans le Web Worker** ; parsing de fichier sur le thread principal
  (rapide) ou worker si besoin.
- **i18n** en/fr, anglais par défaut. **Passerelles Recettes** partout où un flux
  extrait peut être enchaîné.
- **Vérification maison** : fixtures fabriquées en page + scénarios navigateur,
  en dev, en prod et sur le conteneur ; aucune violation de CSP.
- **Cadre défensif/analyse/CTF** : analyser et cacher pour apprendre, pas
  attaquer une cible tierce.

## 3. Découpage en lots (chacun testé et déployable)

Numérotation à la suite du Stego Lab (lots 1–5 faits). Chaque lot = commits
courts en anglais, scénarios, build conteneur vérifié.

### Lot 7 — Analyse visuelle (pur JS, fort effet, faible risque)
Parité avec « Color remapping », « visuels par couleur », « Superposé »,
« Infos ».
- **Grille de plans de bits** : dans l'onglet Plans de bits, un mode « grille »
  affichant les 8 plans d'un canal d'un coup, plus une vue « superposée ».
- **Color remapping** : nouvel onglet — permutations de canaux (RGB, RBG, GRB…),
  fausses couleurs, palettes (niveaux de gris, thermique), négatifs par canal,
  façon Aperisolve « Color remapping ».
- **Onglet Infos** : format, dimensions, profondeur, DPI, type de couleur, MIME,
  taille, **empreintes MD5 / SHA-1 / SHA-256**, nombre de couleurs, et
  **statistiques par canal** (min, max, moyenne, écart-type, entropie) — couvre
  « identify » et « infos basiques ».
- Dépendances : hachage via **WebCrypto** (SHA) + petit MD5 JS (ou spark-md5, MIT).

### Lot 8 — Forensique de format (pur JS)
Parité avec pngcheck, binwalk, foremost, pcrt.
- **pngcheck** : onglet dédié — liste détaillée des chunks, **vérification CRC**,
  interprétation (IHDR, sRGB, pHYs, gAMA, tEXt…), détection d'erreurs, verdict.
- **binwalk / foremost** (fusionnés en « Carve/Extract ») : scan de **toutes**
  les signatures sur tout le fichier, détection de **flux zlib** (tentative
  d'inflate), **carving** des fichiers embarqués (en-tête→pied) avec
  téléchargement de chacun. fflate pour l'inflate.
- **pcrt-lite** : détection et **réparation** de PNG corrompu (signature, CRC
  recalculés, dimensions IHDR retrouvées par force brute), rendu de l'image
  réparée, téléchargement.

### Lot 9 — LSB profond (parité zsteg, pur JS)
- **Mode auto zsteg-like** dans l'onglet LSB : essaie de nombreuses combinaisons
  (bits × canaux × ordre × sens), **détecte** le prometteur (texte imprimable,
  signature de fichier) et présente un **tableau de résultats** classé, façon
  zsteg. L'extracteur manuel du lot 4 reste pour affiner.

### Lot 10 — Éditeur de métadonnées (pur JS, autonome + intégré)
- **Lire / modifier / ajouter / supprimer** EXIF (JPEG via **piexifjs**, MIT) et
  chunks texte PNG (tEXt/iTXt, maison). **Tout effacer** (anonymiser). Re-sauver
  et télécharger.
- **Outil autonome** `/tools/metadata-editor` **et** mode « Édition » dans
  l'onglet Métadonnées du Stego Lab (même code).

### Lot 11 — Cacher des données (pur JS, l'encodeur)
Le pendant « écriture », que même Aperisolve n'a pas.
- **Méthodes** : LSB configurable (interopérable avec notre extracteur), chunk
  texte PNG, ajout après la fin du fichier (EOF), champ de métadonnée.
- **Option mot de passe** : chiffrer le message avant l'embed (WebCrypto AES-GCM,
  ou renvoi vers CyberChef).
- **Outil autonome** `/tools/stego-hide` **et** intégré. Aperçu de la capacité,
  image de sortie téléchargeable, vérification par ré-extraction immédiate.

### Lot 12 — (BONUS conditionnel, reporté) extraction native WASM
- steghide / openstego en WASM (Emscripten). **Go/no-go** selon licence (steghide
  GPL à vérifier ; OpenStego Java → pas WASM simple, plutôt reporté). On s'appuie
  d'abord sur **notre** encodeur/décodeur (lot 11) qui couvre le besoin « cacher
  et retrouver » sans binaire natif.

## 4. Dépendances envisagées (licence à confirmer avant ajout)

| Besoin | Candidat | Licence attendue |
|---|---|---|
| Écriture EXIF (JPEG) | **piexifjs** | MIT |
| MD5 | spark-md5 ou impl maison | MIT |
| SHA-1/256 | **WebCrypto** (natif) | — |
| inflate/deflate | **fflate** (déjà là) | MIT |
| (déjà là) EXIF lecture | exifr | MIT |

Aucun CDN ; tout bundlé ; la CSP reste inchangée.

## 5. Où intègre-t-on quoi

- **Onglets Stego Lab ajoutés** : Color remapping (lot 7), Infos (lot 7),
  pngcheck (lot 8), Carve/Extract (lot 8), Repair (lot 8), + modes enrichis
  (grille de bits lot 7, auto-LSB lot 9, édition métadonnées lot 10, hide lot 11).
- **Deux outils autonomes** au catalogue (catégorie forensics) : `metadata-editor`
  et `stego-hide`, qui réutilisent le code des panneaux.

## 6. Ordre recommandé (effort / impact)

1. **Lot 7** — visuel, spectaculaire, facile, parité immédiate avec les vues
   Aperisolve les plus visibles.
2. **Lot 8** — pngcheck + binwalk/foremost + repair : très demandé en CTF.
3. **Lot 9** — auto-LSB (zsteg).
4. **Lot 11** — cacher des données (différenciateur : Aperisolve ne le fait pas).
5. **Lot 10** — éditeur de métadonnées (utile, autonome).
6. **Lot 12** — WASM natif, seulement si demandé et licences OK.

## 7. Points à trancher avant de coder

- **Licences** de piexifjs / spark-md5 (à confirmer MIT).
- **Coût CPU** du mode auto-LSB (lot 9) et de binwalk sur gros fichiers : worker
  + bornes + annulation.
- **pcrt/repair** : définir le sous-ensemble de corruptions traitées (ne pas
  promettre une réparation universelle).
- **Encodeur (lot 11)** : rester côté « apprentissage/CTF », pas un outil de
  dissimulation malveillante clé en main ; le chiffrement optionnel s'appuie sur
  des primitives standard.

## 8. Ce qui reste hors de ce plan

- **Stégano audio/vidéo** → `stego-audio.md` (spectrogramme, SSTV, DTMF…).
- **Extraction steghide/openstego native** → lot 12, conditionnel.
