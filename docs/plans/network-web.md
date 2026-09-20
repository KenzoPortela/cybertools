# Plan — Réseau & Web (analyse et inspection, 100 % navigateur)

> Document de conception. **Rien n'est implémenté ici** : prompt d'implémentation
> pour une itération future. Voir `docs/DEVELOPMENT.md`.

## 1. Objectif

Faire de cybertools le couteau suisse **réseau et web** de l'analyste : lire une
capture réseau, calculer un sous-réseau, décoder un certificat, comprendre des
en-têtes de sécurité. Tout côté **analyse / inspection / configuration
défensive** — pas d'outillage d'intrusion, pas de scan de cible, pas d'envoi de
requête vers un tiers (la CSP l'interdit de toute façon).

## 2. Principes et contraintes

- **Aucune requête sortante.** Les outils analysent des données **fournies par
  l'utilisateur** (fichier `.pcap` déposé, certificat collé, en-têtes copiés).
  Ce qui exigerait de contacter une cible (ping, scan, requête HTTP réelle) est
  **hors périmètre** — c'est justement ce que les opérations réseau de CyberChef
  écartées faisaient, et qu'on refuse.
- **`vendor/` intact** ; code dans `src/integrations/network/`.
- **Parsing lourd (pcap volumineux) en Web Worker.**
- **i18n** en/fr, anglais par défaut. Catégorie `network` (et `web-dev` pour les
  outils web).
- Passerelles Recettes pour les charges décodées.

## 3. Outils proposés

### Lecteur de capture réseau (pcap / pcapng) — priorité haute, **[nav/wasm]**
- Déposer un `.pcap`/`.pcapng`, le parser en mémoire.
- Vue « paquets » (n°, temps, src/dst, protocole, longueur, info), filtres
  simples type Wireshark léger.
- Décodage des couches courantes : Ethernet, IPv4/IPv6, TCP/UDP/ICMP, ARP, DNS,
  HTTP en clair, TLS (métadonnées : SNI, versions, cipher suites — **sans
  déchiffrer**).
- Suivi de flux TCP, statistiques (top talkers, protocoles), **extraction de
  fichiers** transportés en clair.
- Parser pur JS pour le format pcap ; dissecteurs maison pour les protocoles
  courants. Un port WASM (ex. autour de la logique de tshark) est une piste
  lourde et optionnelle.

### Calculateurs réseau — priorité haute, **[nav]**
- Sous-réseaux IPv4 : CIDR ↔ masque, plage, nombre d'hôtes, découpage VLSM.
- IPv6 : expansion/compression, préfixes, sous-réseaux.
- Agrégation/résumé de routes CIDR, appartenance d'une IP à un préfixe.
- Conversions d'adresses (déjà partiellement chez IT-Tools : compléter sans
  doublonner).

### Décodeurs & inspecteurs — priorité haute, **[nav]**
- **Certificats X.509** : décoder un PEM/DER, chaîne de certificats, champs
  (sujet, émetteur, SAN, validité, empreintes), extensions. Vérifier la
  cohérence d'une chaîne fournie (sans OCSP réseau).
- **En-têtes HTTP** : coller une réponse, analyser les en-têtes de sécurité
  (HSTS, CSP, CORS, cookies, X-*), avec explications et recommandations.
- **Cookies** : décoder, drapeaux (Secure, HttpOnly, SameSite), taille, expiration.
- **User-Agent** : déjà chez IT-Tools ; enrichir seulement si utile.
- **URL / URI** : décomposition, encodage, paramètres, comparaison de deux URL.

### Constructeurs & validateurs de politiques — **[nav]**
- **CSP** : construire/valider une politique, expliquer chaque directive,
  repérer les faiblesses (`unsafe-inline`, `*`, absence de `default-src`).
  Bonus : générer la CSP idéale pour un site statique comme cybertools lui-même.
- **CORS** : simulateur pédagogique (une requête donnée passerait-elle ?).
- **En-têtes de sécurité** : checklist et générateur (HSTS, Referrer-Policy,
  Permissions-Policy, nosniff…).

### Formats web & sérialisation — **[nav]**
- Décodeurs : JWT (renvoi au visualiseur du plan crypto), SAML (base64+inflate+
  XML), protobuf (sans schéma, décodage brut), MessagePack, CBOR, ASN.1/DER,
  BSON. Plusieurs recoupent CyberChef : ne pas doublonner, plutôt offrir une vue
  dédiée plus lisible et enchaînable.
- **Constructeur/testeur de regex** avec visualisation (diagramme ferroviaire),
  surlignage des correspondances, groupes nommés, banc d'essai multi-lignes.

### DNS & divers (sur données fournies) — **[nav]**
- Décodeur de message DNS (paquet fourni, pas de résolution réseau).
- Générateur/validateur d'enregistrements (SPF, DKIM, DMARC, DNSSEC) **à partir
  de valeurs saisies** — analyse et explication, pas d'interrogation en ligne.
- Calcul de sommes de contrôle d'en-têtes, conversion de numéros d'AS, etc.

## 4. Bibliothèques candidates

- pcap : parser JS maison (format simple) ; dissecteurs maison.
- ASN.1/X.509 : lib pure-JS (ex. `@peculiar/asn1-*`, `pkijs`) — valider taille
  et licence GPL-3.0-compatible.
- Regex viz : `regexpp` / rendu maison, ou intégration légère.
- Toute dépendance : pure, bundlée, licence compatible.

## 5. Vérification

- **Fixtures** : petites captures pcap générées (déterministes), certificats de
  test auto-signés, réponses HTTP d'exemple, politiques CSP variées.
- **Scénarios** : le lecteur pcap liste les bons paquets et extrait un fichier
  connu ; le calculateur CIDR donne la bonne plage ; le décodeur X.509 lit le
  bon sujet/SAN ; l'analyseur d'en-têtes signale une CSP faible.
- Tests unitaires sur les fonctions pures (CIDR, parsing).
- Prod + conteneur, zéro violation CSP.

## 6. Découpage en lots (chacun déployable)

1. Calculateurs réseau (IPv4/IPv6, CIDR) — rapide, haute valeur.
2. Décodeurs X.509 + en-têtes HTTP/cookies + analyseur de sécurité.
3. Constructeur/validateur CSP & CORS & en-têtes.
4. Constructeur/testeur de regex avec visualisation.
5. Décodeurs de formats (SAML, protobuf, CBOR, ASN.1…), sans doublonner CyberChef.
6. Lecteur pcap (socle JS) puis extensions (suivi de flux, extraction, TLS meta).

## 7. Risques & points à trancher

- **Cadre défensif strict** : tout ce qui touche à une cible réseau réelle est
  exclu. On analyse des données fournies.
- Complexité du pcap : commencer par les protocoles courants, itérer.
- Doublons avec CyberChef/IT-Tools : privilégier des vues dédiées et
  enchaînables plutôt que re-coder l'existant.

## 8. Hors périmètre

- Scan, ping, requêtes HTTP réelles, résolution DNS en ligne, tout envoi vers un
  tiers : hors sujet (et bloqué par la CSP).
- Outillage offensif réseau : non.
