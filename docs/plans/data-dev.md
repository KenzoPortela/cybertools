# Plan — Données & Dev (formats, conversions, terrains de jeu)

> Document de conception. **Rien n'est implémenté ici** : prompt d'implémentation
> pour une itération future. Voir `docs/DEVELOPMENT.md`.

## 1. Objectif

Couvrir les gestes quotidiens du développeur et de l'analyste de données :
convertir entre formats, requêter/transformer, comparer, générer. Beaucoup
existent en morceaux chez IT-Tools et CyberChef ; l'idée est d'offrir des
**terrains de jeu interactifs** plus riches et **enchaînables** avec les
Recettes, sans doublonner bêtement l'existant.

## 2. Principes et contraintes

- **100 % navigateur**, aucune requête réseau (CSP). Éditeurs et parseurs
  bundlés (Monaco est déjà présent dans le projet — le réutiliser).
- **`vendor/` intact** ; code dans `src/integrations/data/`.
- **Passerelles Recettes** systématiques (entrée/sortie transférables).
- **i18n** en/fr, anglais par défaut. Catégories `data-formats`, `web-dev`, `text`.
- Ne pas dupliquer un outil IT-Tools existant : soit l'enrichir via surcharge,
  soit offrir une vue nettement supérieure, soit s'abstenir.

## 3. Outils proposés

### Convertisseur croisé de formats — priorité haute, **[nav]**
- JSON ↔ YAML ↔ TOML ↔ CSV ↔ XML ↔ .env ↔ properties.
- Détection du format d'entrée, options (indentation, tri des clés, types CSV),
  aperçu côte à côte, gestion des erreurs claire.

### Terrains de jeu de requêtes — priorité haute, **[nav]**
- **JSONPath**, **jq** (portage WASM de jq, ou implémentation JS), **JMESPath**,
  **XPath** sur XML, **SQL sur CSV/JSON** (ex. via une lib SQL en WASM type
  sql.js, ou un moteur JS). Résultat en direct, sur des données locales.
- Éditeur Monaco avec coloration et complétion basique.

### Diff intelligent — priorité haute, **[nav]**
- Texte (déjà chez IT-Tools : vérifier), **JSON structurel** (différences
  sémantiques, pas ligne à ligne), YAML, et **images** (renvoi au Stego Lab pour
  la comparaison pixel). Vue unifiée ou côte à côte, navigation entre diffs.

### Générateurs — **[nav]**
- **Données factices** : à partir d'un schéma ou d'un exemple, générer un jeu
  cohérent (noms, e-mails, dates, UUID…), sans dépendance réseau.
- **Schémas** : déduire un JSON Schema / type TypeScript / interface depuis un
  exemple JSON ; générer un exemple depuis un schéma.
- **Mock d'API** descriptif (OpenAPI → exemples), hors ligne.

### Outils temps & planification — **[nav]**
- **Cron** : construire/expliquer une expression, prochaines exécutions, fuseaux.
- **Dates** : conversions (epoch, ISO, formats), différences, fuseaux horaires,
  durées humaines. Recoupe CyberChef : offrir une vue dédiée plus lisible.

### Formats binaires & bas niveau — **[nav]**
- **Inspecteur hexadécimal** enrichi (déjà partiel via CyberChef Hexdump) :
  gabarits de structures, annotations, sauts d'offset.
- **Désassembleur WASM** (wat), joli-affichage de bytecode, décodage de nombres
  flottants, endianness, structures C ↔ octets.
- **Protobuf sans schéma**, ASN.1, MessagePack, CBOR : vues lisibles (recoupe le
  plan réseau — mutualiser les décodeurs).

### Texte & documents — **[nav]**
- Nettoyage/normalisation de texte (espaces, casse, accents, Unicode NFC/NFD),
  tri/dédoublonnage avancé, colonnes, statistiques (mots, entropie, langue).
- Markdown : aperçu, table des matières, conversion vers HTML/texte.
- Tableaux : CSV ↔ Markdown ↔ HTML ↔ tableau ASCII.

## 4. Bibliothèques candidates

- **Monaco** : déjà dans le projet (workers configurés) — socle des éditeurs.
- **jq** : `jq-wasm` ou équivalent (valider taille/licence) ; repli JSONPath JS.
- **sql.js** (SQLite WASM) pour le SQL-sur-CSV — ~1 Mo, chargé à la demande,
  licence à vérifier.
- Parseurs YAML/TOML/CSV/XML : libs pures JS légères, licence compatible GPL-3.0.
- Tout bundlé, rien depuis un CDN.

## 5. Vérification

- **Fixtures** : jeux d'exemples par format (JSON/YAML/TOML/CSV/XML),
  expressions jq/JSONPath avec résultat attendu, paires de diff connues.
- **Scénarios** : chaque conversion aller-retour préserve les données ; une
  requête jq/JSONPath donne le résultat attendu ; le diff JSON repère la bonne
  différence.
- Tests unitaires sur les convertisseurs (round-trip).
- Prod + conteneur, zéro violation CSP (worker Monaco, WASM sql.js).

## 6. Découpage en lots (chacun déployable)

1. Convertisseur croisé de formats (JSON/YAML/TOML/CSV/XML).
2. Terrains de jeu JSONPath/JMESPath/XPath (JS pur d'abord).
3. Diff intelligent (JSON structurel + texte).
4. Générateurs (données factices, schémas, types).
5. jq (WASM) et SQL-sur-CSV (sql.js) — lots plus lourds, à la demande.
6. Formats binaires & bas niveau (hex enrichi, WASM disasm, décodeurs).

## 7. Risques & points à trancher

- **Doublons** avec IT-Tools/CyberChef : arbitrer au cas par cas (enrichir,
  surpasser, ou s'abstenir).
- Poids des WASM (jq, sql.js) : chargement paresseux strict, badge « lourd ».
- Monaco alourdit déjà le bundle : mutualiser une seule instance/config.

## 8. Hors périmètre

- Exécution de code arbitraire côté serveur : impossible et non souhaité.
- Un IDE complet : on offre des terrains de jeu ciblés, pas un éditeur généraliste.
