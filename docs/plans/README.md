# Plans de développement

Documents de conception pour les futures itérations de cybertools. **Rien n'y est
implémenté** : chacun sert de prompt d'implémentation, à reprendre quand on
décide de lancer le pôle correspondant. On reste en **beta v0.1.0** en attendant
les retours.

Tous les plans partagent les mêmes garde-fous :

- **100 % navigateur, zéro requête réseau.** La CSP servie par l'image l'impose
  (`connect-src 'self'`) — c'est l'argument différenciant face aux services en
  ligne qui uploadent les données. Les dépendances sont pures JS/WASM, bundlées.
- **`vendor/` ne se modifie jamais** ; tout vit dans notre arbre.
- **Cadre défensif / analyse / apprentissage** : décoder, inspecter, identifier,
  expliquer. Pas d'outillage qui attaque une cible tierce.
- **Vérification style maison** (fixtures + scénarios navigateur, en dev, en prod
  et sur le conteneur) et **découpage en lots déployables**.

| Plan | Pôle | Cœur |
|---|---|---|
| [`stego-lab.md`](stego-lab.md) | Stéganographie & forensique image | Aperisolve/StegSolve/zsteg local : bit-planes, LSB, ELA, métadonnées, structure |
| [`stego-audio.md`](stego-audio.md) | Stéganographie & forensique audio | Spectrogramme, LSB audio, DTMF/morse, SSTV |
| [`crypto-ctf.md`](crypto-ctf.md) | Crypto & CTF pédagogique | Identificateur de chiffrement, substitution, Vigenère, chiffres classiques |
| [`network-web.md`](network-web.md) | Réseau & web | Lecteur pcap, calculateurs CIDR, X.509, en-têtes/CSP, regex |
| [`data-dev.md`](data-dev.md) | Données & dev | Conversions croisées, jq/JSONPath/SQL, diff structurel, générateurs |
| [`platform.md`](platform.md) | Plateforme | Espace multi-outils, recettes+, traitement par lots, PWA hors ligne |

## Suggestion d'ordre (par rapport effort/impact)

1. **Confort immédiat, faible risque** — dans `platform.md` : traduction des
   opérations CyberChef, page « Tous les outils », pages de catégorie soignées.
   Plus, hors plan : en-tête HSTS côté proxy, page « Confidentialité »,
   accessibilité.
2. **Effet vitrine** — `stego-lab.md` (l'Aperisolve local, très démonstratif et
   100 % faisable en navigateur).
3. **Fort attrait CTF** — `crypto-ctf.md` (identificateur + substitution +
   Vigenère) et la stégano texte du Stego Lab.
4. **Différenciateur plateforme** — `platform.md` (espace de travail, recettes+).
5. **Extensions** — `network-web.md`, `data-dev.md`, `stego-audio.md`, au fil des
   retours des utilisateurs.

Chaque plan détaille son propre découpage en lots ; on n'attaque un lot qu'après
avoir tranché ses « points à trancher » (surtout licences des dépendances vs
GPL-3.0, et validation CSP + worker/WASM par un mini-POC).
