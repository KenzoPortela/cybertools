# Plan — Crypto & CTF (cryptanalyse pédagogique, 100 % navigateur)

> Document de conception. **Rien n'est implémenté ici** : prompt d'implémentation
> pour une itération future. Voir `docs/DEVELOPMENT.md`.

## 1. Objectif

Compléter CyberChef sur le terrain **CTF et pédagogie crypto** : identifier un
chiffrement inconnu, casser les chiffres classiques, comprendre une faiblesse de
conception. On reste du côté **analyse / apprentissage / défense** — décoder,
identifier, expliquer — jamais fournir un outil clé en main pour attaquer un
système tiers en production.

Public : étudiants, joueurs de CTF, curieux. Chaque outil affiche *pourquoi* ça
marche (indice de coïncidence, fréquences, structure d'un token), pas seulement
le résultat.

## 2. Principes et contraintes

- **100 % navigateur**, aucune requête réseau (CSP `connect-src 'self'`).
  Dictionnaires et tables de fréquences **bundlés**, jamais chargés d'un CDN.
- **`vendor/` intact** ; tout dans notre arbre (`src/integrations/crypto/`).
- **Calculs lourds en Web Worker** (recuit simulé, recherche de clé) avec jeton
  d'annulation façon `useBaker`.
- **Passerelles Recettes** : chaque sortie « ouvrable dans les Recettes » pour
  enchaîner avec les opérations CyberChef existantes.
- **Cadre défensif** : outils tournés vers l'identification et la compréhension.
  Pas de crackage de mots de passe à grande échelle, pas de génération de
  payloads d'intrusion. Un « identificateur de hash » ou un « visualiseur JWT »
  qui *explique* une faiblesse, oui ; un outil qui *exploite une cible*, non.
- **i18n** en/fr dès le départ, anglais par défaut.

## 3. Intégration au catalogue

- Certains sont des **outils natifs** à part entière (source native), d'autres
  gagnent à être des **opérations CyberChef** si elles s'enchaînent bien — dans
  ce cas, les ajouter via nos propres composants d'opération plutôt que de
  toucher `vendor/`.
- Catégorie `crypto` (voir aussi le découpage éventuel de « Crypto & hash »,
  déjà noté comme question ouverte).
- Mots-clés + `src/catalog/synonyms.ts` : cryptanalysis, cipher identifier,
  substitution, vigenere, kasiski, frequency, hash id, jwt (fr : cryptanalyse,
  identifier un chiffrement, analyse fréquentielle).

## 4. Outils proposés

### Identificateur de chiffrement — priorité haute, **[nav]**
- Entrée : un texte chiffré. Sortie : pistes classées avec justification.
- Signaux : indice de coïncidence, distribution des fréquences, taille de
  l'alphabet, présence de base64/hex, longueurs, motifs (répétitions → clé
  courte), ratio voyelles/consonnes.
- Propose : « ressemble à une substitution monoalphabétique », « polyalphabétique
  (Vigenère ?) », « transposition », « probablement base64 puis autre chose »
  (renvoi vers Magic).

### Aide à la substitution monoalphabétique — priorité haute, **[nav]**
- Grille interactive (mapping lettre→lettre) + solveur automatique par **recuit
  simulé** sur un modèle de n-grammes d'une langue (quadgrammes anglais/français
  bundlés). But pédagogique : montrer la convergence.
- Édition manuelle par-dessus la proposition automatique.

### Boîte Vigenère & polyalphabétique — priorité haute, **[nav]**
- Estimation de longueur de clé : **Kasiski** + indice de coïncidence par
  colonne. Récupération de clé colonne par colonne via fréquences.
- Chiffrer/déchiffrer avec clé connue. Variantes : Beaufort, Autokey.

### Chiffres classiques manquants chez CyberChef — **[nav]**
- Hill (2×2, 3×3), Playfair, Nihiliste, scytale/rail-fence avancé, ADFGX/ADFGVX,
  Chaocipher, Bacon (déjà dans CyberChef — vérifier), Polybe.
- Chacun avec chiffrement, déchiffrement, et explication courte.

### Analyse fréquentielle visuelle — **[nav]**
- Histogrammes mono/bi/trigrammes, comparaison avec une langue de référence,
  test du χ², indice de coïncidence. Sert d'appui aux autres outils.

### Identificateur de hash — **[nav]**
- À la hashid : reconnaît le type probable (longueur, charset, préfixes connus
  type `$2b$`, `$argon2`, `{SSHA}`…). **Identifie**, n'attaque pas.
- Lien pédagogique : quel algorithme, quelle robustesse, salé ou non.

### Visualiseur JWT / jetons — **[nav]**
- Décode header/payload, montre la signature et l'algorithme, **explique** les
  pièges de conception : `alg:none`, confusion HS/RS, absence d'expiration,
  claims sensibles. Vérifie une signature si l'utilisateur fournit la clé.
- Pédagogique : « voici pourquoi c'est risqué », sans fournir de forge d'attaque.

### Bac à sable « théorie des nombres » — **[nav]**
- PGCD/PPCM, exponentiation modulaire, inverse modulaire, petit théorème de
  Fermat, CRT, Euclide étendu, test de primalité (Miller-Rabin), pas-de-bébé/
  pas-de-géant pour de petits logarithmes discrets. Support de cours RSA/DH.

### Explorateur RSA pédagogique — **[nav]**
- Génération de petites clés jouet, affichage de n, e, d, φ. **Démonstration**
  de faiblesses académiques sur de petits modules jouets (factorisation d'un n
  minuscule) à but d'enseignement, clairement étiqueté « exemple pédagogique ».

## 5. Bibliothèques candidates

- Tables de n-grammes : générées par nous, bundlées en JSON compressé.
- Grand entiers : `BigInt` natif suffit pour la théorie des nombres jouet.
- Réutiliser au maximum les primitives déjà présentes via CyberChef plutôt que
  d'ajouter des dépendances. Toute dépendance : licence compatible GPL-3.0, pure.

## 6. Vérification

- **Fixtures** : textes de test chiffrés avec clé/paramètres connus (Vigenère,
  substitution, Hill…), vecteurs de hash connus, JWT d'exemple.
- **Scénarios navigateur** : l'identificateur reconnaît le bon type, le solveur
  de substitution retrouve un plaintext connu au-dessus d'un seuil, Kasiski
  trouve la bonne longueur de clé, le visualiseur JWT signale `alg:none`.
- Tests unitaires sur les fonctions pures (fréquences, IC, Kasiski, modulaire).
- Prod + conteneur, aucune violation CSP.

## 7. Découpage en lots (chacun déployable)

1. Analyse fréquentielle + identificateur de chiffrement (socle réutilisé
   partout).
2. Aide à la substitution (grille + recuit simulé en worker).
3. Boîte Vigenère/polyalphabétique (Kasiski, IC, récupération de clé).
4. Chiffres classiques manquants.
5. Identificateur de hash + visualiseur JWT pédagogique.
6. Bac à sable théorie des nombres + explorateur RSA pédagogique.

## 8. Risques & points à trancher

- **Cadre éthique** : formuler chaque outil côté analyse/apprentissage. Éviter
  tout ce qui ressemble à un service d'attaque (crackage massif, forge de
  jetons prête à l'emploi). En cas de doute, ne pas l'ajouter.
- Qualité des n-grammes → qualité du solveur ; prévoir plusieurs langues.
- Performance du recuit simulé sur mobile : borner, worker obligatoire.

## 9. Hors périmètre

- Crackage de mots de passe à l'échelle, génération de wordlists/règles, forge
  de jetons d'attaque : hors sujet et hors esprit du site.
- Ce qui appartient à CyberChef et fonctionne déjà : ne pas ré-implémenter.
