# Avis de recherche publics — première version

## Périmètre

Le module permet d'archiver dans un dossier d'enquête un avis de recherche publié par l'ARPD, le dispositif 116 000 Enfants Disparus ou INTERPOL (notice jaune). L'URL originale est également créée comme source web via le pipeline d'ingestion existant ; la fiche structurée reste liée à cette source et au notebook qui la contient. Depuis une fiche importée, un éditeur peut créer un nouveau dossier privé prérempli avec le même avis ; la source est réingérée dans le nouveau dossier.

## Collecte

Cette version est une **importation manuelle contrôlée**. Elle ne prétend pas disposer d'API publiques ni d'un droit de scraping. Les domaines sont allowlistés côté serveur :
- `arpd.fr`
- `116000enfantsdisparus.fr`
- `interpol.int`

Les connecteurs automatiques, flux officiels ou accords de données devront être ajoutés séparément après vérification des conditions d'utilisation, des règles robots, des droits de réutilisation et des autorisations applicables. Les images ne sont pas copiées ni réhébergées.

## Cycle de vie

- Une fiche créée est `pending_review` et sa publication est `unverified`.
- Un éditeur peut l'approuver ou l'écarter.
- Un éditeur confirme manuellement la publication avant de la marquer `active` ; les statuts `changed`, `removed` ou `unavailable` sont distincts.
- La date de dernière vérification positive n'est actualisée qu'après cette confirmation manuelle.
- L'absence d'une publication ne signifie jamais que la personne a été retrouvée.
- Les révisions de métadonnées conservent un instantané JSON et une empreinte SHA-256.
- Les notices et révisions sont isolées par notebook via RLS ; les écritures passent par des routes authentifiées avec rôle éditeur et journal d'audit.

## Limites

La collecte de la page web et son indexation sont asynchrones via `add_source`. La vérification de présence, la comparaison automatique des révisions, les notifications et les connecteurs programmés ne sont pas encore implémentés. Les champs structurés sont saisis par un éditeur et doivent rester fidèles au contenu de la publication originale. N'ajoutez pas de données non publiées, d'hypothèses d'identité ou de localisation privée.
