# Leanna Investigation Graph — modèle et API

## Objectif

Le graphe relie les éléments d'un dossier sans effacer leur provenance. Une relation est une affirmation documentaire, pas une vérité déduite de la seule proximité de deux nœuds.

Le modèle distingue trois niveaux :

1. **Mention source** : occurrence précise extraite d'un document (investigation_entities).
2. **Nœud canonique candidat** : regroupement possible de plusieurs mentions (investigation_entity_clusters).
3. **Rapprochement humain** : lien entre une mention et un nœud, qui reste candidat tant qu'un éditeur ne l'a pas confirmé (investigation_entity_mentions).

Aucune résolution d'homonyme ni fusion automatique n'est effectuée.

## Modèle de données

| Table | Rôle |
|---|---|
| investigation_entity_clusters | Nœuds canoniques de personnes, lieux, véhicules, objets et organisations |
| investigation_entity_mentions | Rattachement contrôlé d'une mention source à un nœud |
| investigation_relations | Relation typée et orientée entre deux nœuds |
| investigation_relation_evidence | Citation, source, page, offsets et déclaration/événement justificatif |
| investigation_source_lineage | Filiation entre original, copie, extrait, traduction, transcription ou dérivé |
| investigation_contradictions | Dossier de contradiction soumis à revue |
| investigation_contradiction_evidence | Déclarations distinctes qui soutiennent la contradiction |

Les événements existants (investigation_events) restent des assertions propres à une source. La chronologie les rassemble sans les fusionner : chaque ligne conserve son libellé original, sa précision de date, sa pièce et son extrait.

## Règles de provenance

- Les relations sont créées au statut proposed.
- Une relation doit avoir une citation présente dans le texte extrait de sa source.
- Les offsets ne sont enregistrés que s'ils correspondent exactement à la citation.
- Les preuves associées à une déclaration, un événement ou une mention doivent appartenir à la même source que celle déclarée sur la preuve.
- Une contradiction exige au moins deux déclarations issues de deux sources distinctes.
- Chaque citation de contradiction doit être retrouvée dans le texte de la source.
- Une filiation documentaire est orientée original → dérivé ; les cycles sont refusés en base.
- Le worker de recoupement calcule les familles documentaires par composantes de filiation : deux copies, traductions ou dérivés reliés ne comptent que comme une seule origine indépendante. Une piste exige au moins deux familles distinctes.
- Les tables sont protégées par RLS. Les clients authentifiés ont un accès en lecture selon leur rôle ; les écritures passent par les API après contrôle de rôle.
- Les revues sont journalisées dans audit_log.

## API

Toutes les routes sont sous /api/v1/notebooks/:id/investigation/graph.

| Méthode | Route | Fonction |
|---|---|---|
| GET | / | Nœuds, mentions, relations, preuves, filiation, contradictions et chronologie |
| POST | / | Créer un nœud candidat à partir d'une mention, ou proposer un rapprochement vers un nœud existant |
| POST | /relations | Créer une relation proposée avec citation exacte |
| POST | /lineage | Déclarer la filiation de deux sources |
| POST | /contradictions | Créer une contradiction avec au moins deux déclarations de sources distinctes |
| PATCH | /:kind/:recordId | Revue humaine d'un nœud, rapprochement, relation ou contradiction |

Types de revue : cluster, mention, relation, contradiction.

## Interface

L'espace de travail propose un panneau Graphe avec quatre vues :

- Graphe : nœuds, relations, citations et revue humaine.
- Chronologie : événements multi-sources, date originale et précision.
- Contradictions : déclarations conservées côte à côte et liens vers les pièces.
- Provenance : filiation des copies et documents dérivés.

Le formulaire de relation n'est accessible qu'à partir de nœuds canoniques confirmés. Il exige une source prête et une citation exacte.

## Limites de cette première livraison

- Les candidats de relations et de contradictions sont créés manuellement depuis l'interface ou l'API ; la détection automatique des contradictions par IA n'est pas activée.
- La filiation doit être déclarée par un éditeur ; l'empreinte de contenu et la détection automatique des copies restent à construire.
- La chronologie affiche les assertions d'événement existantes ; la fusion sémantique d'événements similaires n'est pas automatique.
- Le rendu du graphe utilise une disposition locale simple ; le clustering visuel, la recherche, le zoom et la pagination des grands graphes restent à améliorer.
- La migration et les tests pgTAP doivent être exécutés en CI avant toute fusion ou déploiement.

## Sécurité métier

Une mention vérifiée signifie seulement que l'extrait existe dans la pièce. Une relation confirmée signifie qu'un éditeur a validé le rapprochement documentaire, pas que l'affirmation est vraie. Les informations rapportées, hypothèses et pistes ne doivent jamais être présentées comme des faits établis ou comme des preuves de culpabilité.
