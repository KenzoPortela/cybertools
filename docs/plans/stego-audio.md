# Plan — Stego Audio (analyse stégano & forensique audio, 100 % navigateur)

> Document de conception. **Rien n'est implémenté ici** : prompt d'implémentation
> pour une itération future. Complète le Stego Lab image (`stego-lab.md`).

## 1. Objectif

Le pendant audio du Stego Lab : déposer un fichier son et l'analyser
entièrement **dans le navigateur**. Cas d'usage CTF emblématiques : « le flag est
écrit dans le spectrogramme », un message en morse ou en DTMF, des données
cachées dans les bits de poids faible d'un WAV.

## 2. Principes et contraintes

- **Aucun upload.** Web Audio API + Web Worker ; la CSP (`connect-src 'self'`,
  `media-src` à vérifier/étendre pour `blob:`) garantit le local.
- **`vendor/` intact** ; code dans `src/integrations/stego-audio/`.
- **Décodage** : Web Audio (`decodeAudioData`) pour les formats gérés par le
  navigateur (WAV, MP3, OGG, FLAC selon support) ; parseur WAV maison pour
  l'accès aux octets bruts (LSB). Formats exotiques → ffmpeg.wasm (lourd, à la
  demande).
- **i18n** en/fr, anglais par défaut. Catégorie `media` (et `forensics`).
- Réutiliser les conventions du Stego Lab image (dépôt, canvas, zoom, worker,
  jeton d'annulation, passerelles Recettes).

## 3. Panneaux proposés

### Spectrogramme interactif — priorité haute, **[nav]**
- FFT par fenêtres (Web Audio `AnalyserNode` ou FFT maison en worker), rendu en
  canvas couleur. Réglages : taille de fenêtre, recouvrement, échelle (linéaire/
  log/mel), plage de fréquences, palette. Zoom/pan temps↔fréquence.
- C'est LE panneau vedette (texte caché dans le spectre).

### Forme d'onde & lecteur — **[nav]**
- Affichage de la forme d'onde, sélection d'une région, lecture, boucle,
  changement de vitesse/pitch, **lecture à l'envers**, isolation d'un canal
  (gauche/droite/différence L−R, cachette classique en stéréo).

### LSB audio — priorité haute, **[nav]**
- Sur un WAV (accès aux échantillons bruts) : extraire les bits de poids faible,
  paramètres (nombre de bits, canal, ordre), reconstruire un flux → texte/
  hexdump, **détection de fichier embarqué** par signatures (mutualiser avec le
  Stego Lab image).

### Décodeurs de signaux — **[nav]**
- **DTMF** (touches téléphoniques) : détecter la séquence de tonalités.
- **Morse audio** : détecter les impulsions et décoder.
- **SSTV** (image transmise en son) : ambitieux mais spectaculaire ; décoder les
  modes courants (Robot, Martin, Scottie) vers une image. À isoler en lot dédié.

### Métadonnées & structure — **[nav]**
- Tags ID3/Vorbis/FLAC, chunks WAV (dont chunks non standard porteurs de
  données), données après la fin logique (trailing), commentaires.

### Analyse fine — **[nav]**
- Entropie temporelle, détection de silence/tonalité pure, différence entre deux
  pistes, mesure de débit binaire caché plausible.

## 4. Bibliothèques candidates

- FFT : implémentation JS légère (ex. autour d'un radix-2 maison) en worker, ou
  `AnalyserNode` pour l'aperçu.
- **ffmpeg.wasm** (~25 Mo) : uniquement pour décoder les formats non gérés
  nativement, chargé à la demande, badge « lourd ». Licence à vérifier
  (LGPL/GPL selon build) vs GPL-3.0 du projet — **point à trancher**.
- Parseur WAV/ID3 maison (formats simples).
- Tout bundlé, rien depuis un CDN.

## 5. Vérification

- **Fixtures** : sons générés (script Node) — un WAV avec message en LSB connu,
  une tonalité DTMF connue, un morse audio connu, un spectrogramme portant un
  texte connu.
- **Scénarios** : le LSB retrouve la chaîne, le décodeur DTMF/morse donne la
  bonne séquence, le spectrogramme se rend sans erreur. Attention : certains
  tests audio sont non déterministes → viser des vérifications robustes
  (présence, longueur, seuils) plutôt que pixel-exact.
- Prod + conteneur, CSP (worker + éventuel WASM + `media-src blob:`).

## 6. Découpage en lots (chacun déployable)

1. Socle audio (dépôt, décodage WAV/formats natifs, forme d'onde, lecteur).
2. Spectrogramme interactif (worker FFT).
3. LSB audio + métadonnées/structure + trailing data.
4. Décodeurs DTMF & morse.
5. SSTV (lot dédié, ambitieux).
6. ffmpeg.wasm pour les formats exotiques (lot lourd, go/no-go selon licence).

## 7. Risques & points à trancher

- **Licence ffmpeg.wasm** vs GPL-3.0 : à vérifier avant tout usage.
- **`media-src`** de la CSP : confirmer/étendre pour `blob:`/`mediastream:` (déjà
  partiellement présent) sans ouvrir de brèche réseau.
- Déterminisme des tests audio : concevoir des fixtures et des seuils robustes.
- Coût CPU du spectrogramme sur mobile : worker + bornes.

## 8. Hors périmètre

- Édition audio générale (on n'est pas un DAW) : seulement l'analyse.
- Reconnaissance vocale / musique : hors sujet cyber.
