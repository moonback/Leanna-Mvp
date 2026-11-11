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

## 9. État réel de la version actuelle

La version actuelle comprend :
- la spécialisation des prompts du chat, de Leanna/Roxane et du Studio ;
- les libellés de l'accueil et de l'espace dossier orientés enquêtes ;
- un registre persistant pour les entités mentionnées, événements, déclarations et pistes ;
- une provenance par source, extrait exact, page et offsets quand disponibles ;
- une extraction IA explicite par lots, avec validation stricte des citations, reprise idempotente et réservation atomique de 1 crédit par source ;
- un recoupement multi-sources facturé 5 crédits par analyse, avec réservation au moment de la mise en file ;
- un recoupement multi-sources qui ne propose une piste que si elle relie au moins deux sources distinctes ;
- un registre de preuves pour chaque piste, y compris les éléments contraires ;
- une revue humaine avec statuts et journalisation.

Les pistes créées par l'IA restent au statut proposé. Un extrait marqué comme contrôlé signifie que sa présence dans la pièce a été vérifiée, pas que l'affirmation rapportée est vraie. Aucune personne n'est fusionnée automatiquement avec un homonyme et aucune piste n'est une preuve ou une conclusion.

Restent à développer : résolution prudente des homonymes, graphe de relations persistantes entre éléments, vues chronologiques avancées, analyse des contradictions avec une gestion plus fine des témoignages indépendants, et tests d'intégration complets sur une base Supabase locale.
