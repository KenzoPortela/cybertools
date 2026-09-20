# Plan — Stego Lab (analyse stégano & forensique d'image, 100 % navigateur)

> Document de conception. **Rien n'est implémenté ici** : il sert de prompt
> d'implémentation pour une itération future (visée v0.2). Il suppose la
> connaissance du reste du dépôt ; voir `docs/DEVELOPMENT.md`.

## 1. Objectif

Un outil unique, `/tools/stego-lab`, qui reproduit et dépasse Aperisolve /
StegSolve / zsteg **sans jamais envoyer l'image à un serveur**. On dépose une
image, elle est décodée en mémoire, et toutes les analyses tournent dans le
navigateur (Web Workers + WebAssembly). C'est l'argument différenciant : les
services en ligne concurrents uploadent le fichier ; ici, la CSP
(`connect-src 'self'`) interdit techniquement toute fuite.

Public visé : CTF, forensique défensive, curiosité pédagogique. Le ton reste
« analyser / inspecter / expliquer », jamais « attaquer une cible tierce ».

## 2. Principes et contraintes (à respecter absolument)

- **Aucune requête réseau.** La CSP servie par l'image l'interdit déjà
  (`connect-src 'self' data: blob:`, `img-src 'self' data: blob:`,
  `worker-src 'self' blob:`, `wasm-unsafe-eval` présent). Toute dépendance doit
  être **pure JS/WASM, bundlée**, jamais chargée depuis un CDN.
- **L'image ne quitte pas la page.** Pas de `localStorage` pour les pixels ; en
  mémoire uniquement, comme l'entrée des Recettes. Rien n'est persistant sauf
  les préférences d'affichage (clé `cybertools:settings` ou une clé dédiée).
- **`vendor/` ne se modifie pas.** Tout le code du Stego Lab vit dans notre
  arbre (`src/integrations/stego/` proposé).
- **Réactivité de l'UI.** Le travail pixel (bit-planes, LSB, ELA sur une image
  de plusieurs Mpx) doit tourner en **Web Worker** (OffscreenCanvas), pas sur le
  thread principal. Vite compile un worker `self`-origin, autorisé par la CSP.
- **Cohérence visuelle.** Composants naive-ui, variables `--ct-*`, arrondi
  unique, JetBrains Mono pour les libellés techniques, layout `wide`. Réutiliser
  `CcInput`/zone de dépôt et les conventions existantes.
- **i18n dès le départ** : `src/locales/en.yml` et `fr.yml`, anglais par défaut.
- **Chargement à la demande.** L'outil est lourd ; renderer `vue` en
  `() => import(...)`, et chaque brique WASM chargée seulement quand son onglet
  est ouvert.

## 3. Intégration au catalogue

- **Source native.** Ajouter l'entrée dans `src/catalog/sources/native.ts` :
  `id: 'stego-lab'`, `slug: 'stego-lab'`, catégorie `forensics`, icône au trait
  (mdi, ex. `~icons/mdi/image-search-outline`), `layout: 'wide'`,
  `renderer: { kind: 'vue', component: () => import('~/integrations/stego/StegoLab.vue') }`,
  aliases `['/steg', '/steganography', '/aperisolve']`.
- **Recherche.** Mots-clés riches dans la déclaration + entrée éventuelle dans
  `src/catalog/synonyms.ts` : stego, steganography, aperisolve, stegsolve, zsteg,
  exif, lsb, bit plane, ela, spectrogram, forensics, steghide… (fr : stégano,
  métadonnées, plan de bits, dissimulation).
- **Vedette accueil ?** Optionnel : une 3ᵉ carte « à la une » sur `HomePage.vue`
  à côté de Recettes et Magic, une fois l'outil mûr.
- **i18n** : bloc `app.native.stegoLab.{title,description}` + un espace
  `app.stego.*` pour tous les libellés internes.

## 4. Architecture technique

```
src/integrations/stego/
  StegoLab.vue                 orchestrateur : dépôt d'image, barre d'onglets, zoom/pan partagé
  useStegoImage.ts             composable : chargement, décodage, ImageData plein-res + aperçu réduit, état partagé
  stego-worker.ts              Web Worker : opérations pixel lourdes (bit-planes, LSB, ELA, canaux, entropie)
  worker-protocol.ts           types des messages worker (requête/réponse, transfert d'ImageData/ArrayBuffer)
  formats/
    png.ts                     parseur de chunks PNG (lecture seule)
    jpeg.ts                    parseur de segments JPEG (APP0/APPn, marqueurs)
    gif.ts, bmp.ts, webp.ts    parseurs minimaux
    trailing.ts                détection de données après la fin logique du fichier + signatures (mini-binwalk)
    signatures.ts              table de magic bytes (PK, PNG, JPEG, PDF, RAR, 7z, ELF, gzip…)
  metadata/
    exif.ts                    façade autour d'une lib pure-JS (exifr) : EXIF/IPTC/XMP/ICC/GPS
  panels/
    PanelBitPlanes.vue         StegSolve : plans de bits par canal, navigation
    PanelLsb.vue               zsteg-like : extraction LSB configurable
    PanelChannels.vue          séparation/recombinaison canaux, négatif, contraste, égalisation
    PanelCompare.vue           superposition / différence / XOR de deux images
    PanelEla.vue               Error Level Analysis
    PanelMetadata.vue          EXIF/IPTC/XMP/ICC, GPS copiable, carte statique si possible sans réseau
    PanelStructure.vue         inspecteur PNG/JPEG chunks + trailing data + polyglotte
    PanelStrings.vue           strings filtrables + carte d'entropie
    PanelExtract.vue           steghide/outguess (WASM) — phase ultérieure
  StegoResultCanvas.vue        canvas réutilisable : rendu, zoom/pan synchronisé, téléchargement PNG
  stego-catalog.ts             liste déclarative des panneaux (id, titre i18n, icône, lazy component, coût)
```

**Flux de données**
1. Dépôt/collage/sélection → `useStegoImage` lit le `File`, garde le
   `ArrayBuffer` brut (pour les parseurs de format et le trailing data) et
   décode en `ImageBitmap` → `ImageData` (canvas ou `createImageBitmap`).
2. Deux résolutions : **plein-res** pour l'analyse, **aperçu borné** (ex.
   1600 px max) pour l'affichage fluide. Les transformations affichées se font
   sur l'aperçu ; l'export se refait en plein-res à la demande.
3. Les opérations pixel sont envoyées au **worker** avec l'`ImageData`
   (transférable). Le worker renvoie un `ImageData`/`ArrayBuffer` transféré. Le
   panneau le peint via `StegoResultCanvas`.
4. Zoom/pan et position sont un **état partagé** entre panneaux (comparer deux
   vues au même endroit — utile en stégano).

**Web Worker**
- Un worker unique multiplexé (routage par `type` de message), ou un pool si le
  profilage le justifie. `worker-protocol.ts` type les échanges.
- OffscreenCanvas dans le worker pour ELA (ré-encodage JPEG via `convertToBlob`).
- Annulation : jeton de génération (comme `useBaker`) pour ignorer les réponses
  périmées quand on change vite de réglage.

## 5. Détail des panneaux (périmètre v0.2 puis extensions)

### Bit planes (StegSolve) — **[nav]**, priorité haute
- Pour chaque canal R/G/B/A et bit 0→7 : image binaire du plan.
- Modes : plan isolé, XOR de plans, « toutes les combinaisons » en vignettes.
- Navigation clavier (← →), toggles rapides, export du plan courant.

### Extraction LSB (zsteg) — **[nav]**, priorité haute
- Paramètres : bits (1–8), ordre des canaux, sens (row/col), MSB/LSB first,
  regroupement par octet.
- Sortie : flux binaire → texte (heuristique UTF-8/ASCII), hexdump, et
  **détection de fichier embarqué** par signatures (réutilise `signatures.ts`).
- Bouton « ouvrir la sortie dans les Recettes » (passerelle vers CyberChef).

### Canaux & rehaussements — **[nav]**, priorité haute
- Séparation/recombinaison R/G/B/A, niveaux de gris, négatif, seuillage,
  contraste extrême, égalisation d'histogramme, gamma.
- Utile pour révéler du texte caché dans un canal.

### Comparaison de deux images — **[nav]**
- Différence absolue, XOR, superposition avec opacité, « swipe ».
- Cas typique : image originale vs image modifiée.

### ELA — **[nav]**, priorité haute
- Ré-encoder en JPEG à qualité Q (réglable), soustraire, amplifier.
- OffscreenCanvas + `convertToBlob({type:'image/jpeg', quality})` dans le worker.

### Métadonnées — **[nav]**, priorité haute
- Lib pure-JS **exifr** (EXIF/IPTC/XMP/ICC/GPS), bundlée. Vérifier taille et
  tree-shaking ; sinon parseur maison EXIF minimal.
- GPS affiché en coordonnées **copiables** (pas de carte réseau ; éventuellement
  un lien externe que l'utilisateur clique lui-même, jamais de tuile chargée).
- Champs bruts + interprétés, recherche dans les métadonnées.

### Inspecteur de structure — **[nav]**, priorité haute
- PNG : liste des chunks (type, taille, CRC, offset), affichage des chunks
  texte (tEXt/zTXt/iTXt) souvent porteurs de messages.
- JPEG : segments/marqueurs, commentaires (COM), APPn.
- **Trailing data** : octets après la fin logique (IEND, EOI…) — cachette
  classique — avec identification par signature (zip, autre image, PDF…).
- Détection de **polyglotte** (ex. PNG+ZIP).

### Strings & entropie — **[nav]**
- `strings` (longueur mini, ASCII/UTF-16), filtres regex, mise en évidence
  d'URL/base64/hex.
- Carte d'entropie par blocs (repérer une zone chiffrée/compressée).

### Extraction avec outils natifs — **[wasm]**, phase ultérieure
- steghide, outguess, jsteg : binaires C/C++. Deux voies : compiler en WASM
  (Emscripten) et bundler, ou attendre des ports existants sûrs. Gros effort,
  chargé uniquement à l'ouverture de ce panneau (plusieurs Mo).
- Champ mot de passe pour steghide (reste local).

## 6. Bibliothèques candidates (toutes pures / bundlées)

- **exifr** — métadonnées (EXIF/IPTC/XMP/ICC/GPS), pur JS. À valider :
  taille, licence (compat GPL-3.0), tree-shaking.
- **fflate** — inflate/deflate pour zTXt, zip embarqués, trailing zip. Léger.
- Décodage image : API navigateur (`createImageBitmap`, `<canvas>`) d'abord ;
  formats exotiques seulement si besoin.
- **ffmpeg.wasm**, **Tesseract.wasm** : hors périmètre stego image, notés pour
  les extensions audio/OCR d'un autre plan.
- Chaque ajout passe par `package.json` (pas `vendor/`) ; vérifier la
  **compatibilité de licence GPL-3.0** et l'absence d'appel réseau au runtime.

## 7. Performance & robustesse

- Borner la taille : au-delà de N Mpx, prévenir et proposer de travailler sur
  l'aperçu réduit ; downscale pour l'affichage, plein-res pour l'export.
- Transferts **zéro-copie** (`postMessage` avec `Transferable`).
- États : *aucune image*, *chargement*, *format non décodable*, *image énorme*,
  *worker indisponible* (repli thread principal dégradé).
- Nettoyage mémoire : révoquer les `blob:` URL, libérer les gros buffers au
  changement d'image.
- Tout est faisable hors-ligne (cohérent avec une future PWA).

## 8. UX

- Zone de dépôt plein cadre (drag & drop + `<input file>` + **coller** une image
  du presse-papiers). Sélecteur pour la 2ᵉ image du panneau comparaison.
- Barre d'onglets = `stego-catalog.ts` ; chaque onglet lazy-load son panneau et
  son éventuel WASM. Badge « lourd » sur les onglets coûteux.
- Canvas commun : zoom molette, pan, ajuster/100 %, coordonnées + valeur du
  pixel survolé, export PNG de la vue.
- Cohérence mobile : onglets en menu déroulant, canvas tactile (pinch/pan).
- Passerelles : « ouvrir la sortie dans les Recettes », « analyser le fichier
  extrait » (recharger l'extrait comme nouvelle entrée).

## 9. i18n

- `app.native.stegoLab.title/description` (en + fr).
- Espace `app.stego.*` : titres d'onglets, réglages, états, aides. Anglais
  d'abord, français complet. Pas de texte en dur dans les composants.

## 10. Vérification (obligatoire, style maison)

- **Fixtures** : petites images générées (script Node) avec cas connus — message
  en LSB, texte dans un chunk PNG tEXt, zip en trailing data, EXIF avec GPS,
  retouche visible en ELA. Committées sous `build/fixtures/stego/`.
- **Scénario navigateur** `build/scenarios/stego.json` + éventuel générateur
  `build/scripts/scenario-stego.mjs` : charger chaque fixture, ouvrir chaque
  panneau, vérifier un résultat déterministe (ex. le LSB retrouve la chaîne
  connue, le panneau structure liste le chunk attendu, le trailing data est
  détecté). Chaque script renvoie `true`.
- **Prod + conteneur** : rejouer sur `npm run preview` et sur l'image Docker,
  pour confirmer que la CSP ne bloque ni le worker ni le WASM.
- **CSP** : aucune violation console (le harness les capte déjà).
- **Typecheck** propre, `vendor/` intact.

## 11. Découpage en lots (chacun déployable)

1. **Socle** : entrée catalogue, `StegoLab.vue`, dépôt/collage d'image,
   `useStegoImage`, canvas commun (zoom/pan/export), squelette d'onglets,
   worker vide, i18n de base, 1er scénario. Déployable, visible.
2. **Cœur pixel** : bit-planes, canaux/rehaussements, entropie. Worker réel.
3. **Métadonnées + structure + trailing data** : exifr, parseurs PNG/JPEG,
   signatures, polyglotte.
4. **LSB configurable + strings** + passerelles Recettes.
5. **ELA + comparaison de deux images.**
6. **Extraction WASM (steghide/outguess)** — lot lourd, isolé, chargé à la
   demande. Décision go/no-go selon effort et licences.

À chaque lot : commit, scénarios, build Docker vérifié — comme les étapes
précédentes. On reste en **beta v0.1.0** tant que le socle n'est pas jugé mûr ;
passage v0.2.0 quand les lots 1–4 sont en place.

## 12. Risques & points à trancher avant de coder

- **exifr** : taille bundle et licence (compat GPL-3.0). Repli : parseur EXIF
  maison minimal.
- ** Port WASM steghide/outguess** : gros effort, à confirmer (ou reporter).
- **CSP + worker Vite** : valider tôt qu'un worker `self` + WASM passe la CSP de
  production (un mini-POC dès le lot 1).
- **Mémoire mobile** : bornes de taille d'image sur téléphone.
- **Licences des fixtures** : n'utiliser que des images générées par nos soins.

## 13. Hors périmètre (à garder pour d'autres plans)

- Audio/vidéo (spectrogramme, SSTV, DTMF) → plan « Stego Audio ».
- OCR (Tesseract.wasm), analyse de firmware (binwalk WASM), pcap.
- Tout ce qui exploite une cible tierce : hors sujet, hors esprit du site.
