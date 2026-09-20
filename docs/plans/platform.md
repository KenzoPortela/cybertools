# Plan — Plateforme (le différenciateur long terme)

> Document de conception. **Rien n'est implémenté ici** : prompt d'implémentation
> pour une itération future. Voir `docs/DEVELOPMENT.md`.

## 1. Objectif

Au-delà d'ajouter des outils, faire de cybertools une **plateforme** : plusieurs
outils qui coopèrent, un travail qu'on reprend, une app installable et hors
ligne. C'est ce qui, à terme, fait qu'on « pense à cybertools » plutôt qu'à dix
sites séparés — et ce qu'aucun clone d'IT-Tools/CyberChef n'offre.

## 2. Principes et contraintes

- **100 % local**, aucune synchronisation serveur (cohérent avec la CSP et la
  promesse « rien ne sort du navigateur »). Le partage se fait par **lien**
  (comme les Recettes aujourd'hui), pas par compte.
- **`vendor/` intact.** Fonctionnalités transverses dans `src/app/` et
  `src/integrations/`.
- **Rétrocompatibilité** : ne pas casser les liens de recette existants ni les
  clés `cybertools:*` du `localStorage`.
- **i18n** en/fr, anglais par défaut. Accessibilité de première classe.

## 3. Fonctionnalités proposées

### Espace de travail multi-outils — priorité haute, **[nav]**
- Ouvrir plusieurs outils côte à côte (grille/onglets), la **sortie de l'un
  alimentant l'entrée de l'autre**. Généralisation de la passerelle « ouvrir
  dans les Recettes » à tout le catalogue.
- État de l'espace sérialisable dans un lien (sans les données saisies).

### Recettes améliorées — priorité haute, **[nav]**
- **Sous-recettes réutilisables** (une recette appelée comme une étape),
  **variables** (réutiliser une valeur), **recettes nommées** sauvegardées
  localement, catalogue personnel.
- **Traitement par lots** : appliquer une recette à plusieurs fichiers déposés,
  résultats téléchargeables en archive (zip généré côté client).
- Export « fiche » lisible d'une recette (documentation partageable).

### Historique local — **[nav]**
- Journal de ce qu'on a fait (outils ouverts, recettes lancées), consultable,
  effaçable, jamais synchronisé. Respecte la page Paramètres (bouton d'effacement
  déjà présent pour les données).

### PWA & hors ligne — priorité haute, **[nav]**
- Manifest + service worker : app **installable**, fonctionnant **hors ligne**
  (cohérent avec le 100 % navigateur). Attention à la CSP et au cache des gros
  assets (worker CyberChef, futurs WASM). Stratégie de mise à jour claire
  (nouvelle version disponible → invite à recharger).

### Recherche & navigation enrichies — **[nav]**
- **Traduction des noms d'opérations CyberChef** (la mécanique `app.ops.<slug>`
  existe déjà, les textes restent à écrire) — gros gain de confort en français.
- Page « **Tous les outils** » filtrable (par source, catégorie, tag), pages de
  catégorie soignées, comptes à jour.
- Palette de commandes enrichie : actions récentes, « refaire la dernière
  recette », navigation par tag.

### Partage & interopérabilité — **[nav]**
- Liens de recette déjà compatibles cyberchef.org : maintenir et étendre.
- Import/export global des préférences (déjà en place) — garder aligné avec les
  nouvelles clés.

## 4. Vérification

- **Scénarios navigateur** : chaînage d'outils dans l'espace de travail, sous-
  recette qui produit le bon résultat, traitement par lots sur plusieurs
  fichiers, service worker qui sert hors ligne (test en coupant le réseau dans
  le harness), page « Tous les outils » qui filtre correctement.
- **Non-régression** : les liens de recette et les clés `localStorage` existants
  continuent de fonctionner.
- Tests unitaires sur la sérialisation d'espace de travail et de recette.
- Prod + conteneur ; **attention CSP + service worker** (POC tôt).

## 5. Découpage en lots (chacun déployable)

1. Traduction des opérations CyberChef + page « Tous les outils » + pages de
   catégorie soignées (rapide, fort confort, faible risque).
2. Recettes améliorées : recettes nommées locales + export « fiche ».
3. Traitement par lots (multi-fichiers, zip client).
4. Espace de travail multi-outils (chaînage généralisé).
5. Sous-recettes & variables.
6. PWA & hors ligne (service worker, manifest, stratégie de cache/MAJ).
7. Historique local + palette enrichie.

## 6. Risques & points à trancher

- **Service worker vs CSP et gros assets** : valider tôt que le worker CyberChef
  et les futurs WASM se mettent en cache proprement, et concevoir la MAJ pour ne
  pas servir une version périmée.
- **Complexité de l'espace de travail** : commencer simple (deux volets
  chaînés), itérer.
- **Poids** : la PWA doit rester honnête sur ce qu'elle télécharge hors ligne.
- Ne pas trahir le « local » : aucune fonctionnalité n'introduit de compte ni de
  synchronisation serveur.

## 7. Hors périmètre

- Comptes utilisateurs, synchronisation cloud, collaboration temps réel : contre
  la promesse du produit.
- Un backend : le site reste statique.
