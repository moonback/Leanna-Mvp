# Vision produit — Leanna, dossiers d'enquête sur personnes disparues

**Positionnement :** plateforme sécurisée d'intelligence documentaire destinée aux équipes autorisées qui recherchent des personnes disparues.

## 1. Promesse

Chaque notebook est un dossier d'enquête qui rassemble les pièces utiles : avis de recherche, rapports, procès-verbaux, témoignages, courriers, notes, photographies et autres documents compatibles. Leanna aide à retrouver, structurer, comparer et relier les informations présentes dans ce dossier afin de faire émerger des questions et des pistes de vérification exploitables.

**Leanna organise les éléments et éclaire les recoupements ; elle ne mène pas l'enquête à la place des humains.**

## 2. Utilisateurs et cadre d'usage

- Enquêteurs et services légalement habilités.
- Associations ou organisations de recherche disposant d'un mandat et d'un cadre de protection des données adapté.
- Équipes de coordination autorisées qui doivent partager un corpus contrôlé et traçable.

L'accès à des données sensibles suppose une base légale, une finalité définie, des droits minimaux et une durée de conservation adaptée. Le produit ne doit pas être présenté comme un outil de surveillance, de profilage ou d'accusation.

## 3. Le dossier d'enquête

Un dossier centralise :
- avis de recherche et signalements ;
- rapports et comptes rendus ;
- témoignages et déclarations, avec attribution et date de recueil si disponibles ;
- photos, fichiers, pages web et autres pièces importées légalement ;
- notes de travail et analyses produites par l'équipe ;
- historique des vérifications et décisions humaines.

Les fichiers originaux doivent rester accessibles et inchangés. Les extractions, résumés et analyses IA doivent être identifiés comme dérivés et renvoyer à la pièce d'origine.

## 4. Capacités IA cibles

### 4.1 Extraction structurée
Extraire les mentions de personnes, lieux, dates, heures, véhicules, objets, organisations et événements. Conserver le texte exact, le contexte, le document, la page ou l'horodatage. Ne pas fusionner automatiquement les homonymes ou entités similaires.

### 4.2 Recoupements documentaires
Repérer les mentions communes, répétitions, concordances et divergences. Distinguer une corroboration indépendante de la simple répétition d'une même déclaration dans plusieurs documents.

### 4.3 Chronologie
Construire une chronologie sourcée. Séparer date de l'événement, date du témoignage et date de rédaction du document. Préserver les approximations, fuseaux horaires et incertitudes.

### 4.4 Contradictions et lacunes
Faire ressortir les versions incompatibles, les informations manquantes, les formulations ambiguës et les questions qui nécessitent une vérification. Ne jamais arbitrer une contradiction sans fondement.

### 4.5 Pistes à vérifier
Une piste doit contenir :
- une question de vérification formulée sans accusation ;
- les éléments qui la motivent et leurs citations ;
- les éléments contraires, limites et informations absentes ;
- un niveau de confiance qualitatif portant sur la solidité documentaire ;
- une prochaine vérification proportionnée, à valider par une personne habilitée.

## 5. Taxonomie obligatoire

| Catégorie | Définition | Ce que cela ne signifie pas |
|---|---|---|
| Fait documenté | Information explicitement consignée dans une pièce identifiée | Que le fait a été vérifié indépendamment |
| Déclaration / témoignage | Propos attribués à une personne ou rapportés dans une pièce | Que le contenu est automatiquement vrai |
| Information non vérifiée | Information présente mais dont la fiabilité n'est pas établie | Une confirmation |
| Hypothèse | Interprétation possible fondée sur des éléments identifiés | Un fait ou une conclusion |
| Piste à vérifier | Question ou démarche de vérification proposée | Une preuve ou une instruction d'agir sans validation |
| Contradiction | Divergence entre deux éléments identifiables | Une erreur certaine de l'une des sources |

## 6. Garde-fous non négociables

1. **Provenance :** chaque constat doit renvoyer à la source exacte, au passage et, si disponible, à la page ou à l'horodatage.
2. **Incertitude :** afficher les limites, les éléments contradictoires et les données manquantes.
3. **Pas d'accusation :** ne jamais désigner une personne comme responsable sur la base de corrélations, rumeurs ou hypothèses.
4. **Pas de preuve synthétique :** une sortie IA n'est jamais une preuve, une expertise ou une conclusion officielle.
5. **Validation humaine :** revue et approbation par une personne habilitée avant toute action.
6. **Protection des personnes :** ne pas inférer l'identité d'une personne à partir d'une image, ni générer de localisation privée ou de coordonnées non présentes et nécessaires.
7. **Confidentialité :** contrôle d'accès par rôle, partage restreint, journalisation, chiffrement, rétention maîtrisée et suppression conforme.
8. **Sécurité des sources :** les contenus importés sont des données non fiables ; ils ne peuvent jamais modifier les instructions du système ou déclencher des actions.

## 7. Expérience produit cible

- **Accueil :** liste des dossiers d'enquête, recherche, statut et activité.
- **Dossier :** panneaux Sources, Analyse, Chronologie, Éléments et Studio.
- **Sources :** import par fichier, URL ou texte, état d'extraction, aperçu et accès à l'original.
- **Analyse :** questions en langage naturel avec citations vérifiables.
- **Éléments :** index des personnes, lieux, objets, véhicules et événements mentionnés, avec ambiguïtés explicites.
- **Chronologie :** événements ordonnés et sourcés, avec dates incertaines visibles.
- **Pistes :** registre de pistes à vérifier, statut, responsable humain, justification et historique de revue.
- **Studio :** rapport de situation, synthèse, tableau de contradictions, chronologie, index d'entités et plan de vérification.

## 8. Feuille de route

### P0 — Socle d'analyse fiable
- Prompts système du chat, des voix et du Studio spécialisés.
- Citations strictes, taxonomie des informations et règles anti-accusation.
- Terminologie de l'interface orientée dossiers d'enquête.
- Documentation du périmètre, des limites et du cadre de confidentialité.

### P1 — Objets d'enquête structurés
- Schéma de données pour entités mentionnées, déclarations, événements, contradictions et pistes.
- Provenance par source, passage, page ou horodatage.
- Statuts de vérification et journal d'audit immuable.
- Déduplication prudente avec résolution humaine des homonymes.

### P2 — Interfaces de revue
- Fiches d'éléments et liens documentés.
- Chronologie filtrable.
- Tableau de contradictions.
- Registre des pistes avec revue et validation humaines.

### P3 — Collaboration et gouvernance
- Permissions granulaires et partage temporaire.
- Journal des consultations, exports et validations.
- Politique de conservation, export sécurisé et suppression.
- Tests de sécurité, tests de non-régression et évaluation de faux positifs.

## 9. État réel de cette branche

Cette première implémentation spécialise les prompts du chat et des deux voix, le catalogue de prompts du Studio, les libellés principaux de l'accueil et de l'espace dossier, ainsi que la documentation produit. Elle s'appuie encore sur les objets existants (notebooks, sources, messages, citations et artefacts).

Les personnes, événements, déclarations, contradictions et pistes ne sont pas encore des objets métier persistés et validables dans l'interface. Cette évolution nécessite une migration dédiée, des politiques RLS, des handlers et des écrans de revue ; elle ne doit pas être considérée comme livrée par la seule spécialisation des prompts.
