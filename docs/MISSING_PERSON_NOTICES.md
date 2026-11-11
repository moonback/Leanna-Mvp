# Avis de recherche — veille automatique et dossiers d'enquête

## Fonctionnement

Le module combine un catalogue de publications détectées automatiquement et des fiches privées rattachées aux dossiers d'enquête.

- Le worker Node interroge le flux RSS WordPress du site 116 000 toutes les 15 minutes.
- Les requêtes utilisent ETag et Last-Modified lorsqu'ils sont fournis par le serveur, avec délai réseau, limite de taille, validation stricte du domaine et bail SQL pour éviter les synchronisations concurrentes.
- Les métadonnées publiques (titre, URL, extrait RSS, date et identifiant de publication) sont conservées dans un catalogue global.
- Les utilisateurs connectés voient les publications détectées depuis l'espace Avis de recherche de leur dossier. Ils peuvent ajouter une publication à ce dossier ou créer directement un nouveau dossier privé.
- L'import d'une publication déclenche la création d'une source web via le pipeline `add_source`. La fiche est en attente de revue humaine.
- Une modification du titre, de l'URL, de l'extrait ou de la date crée un nouvel état de catalogue avec statut `changed`.

## Sources et limites d'accès

| Source | Automatisation | Motif |
|---|---|---|
| 116 000 Enfants Disparus | RSS configuré, synchronisation automatique toutes les 15 minutes | Le worker ne lit que le flux public du domaine officiel et ne télécharge aucune photo. Vérifier la disponibilité effective du flux sur l'environnement déployé. |
| ARPD | Désactivée pour le moment | L'annuaire public est visible, mais le flux officiel et les conditions d'accès automatisé n'ont pas été confirmés. Le domaine renvoie actuellement une réponse 403 à la consultation automatisée utilisée pendant l'audit. |
| INTERPOL — notices jaunes | Pas de collecte automatique | INTERPOL indique que certaines notices sont réservées aux services de police. Les conditions du site limitent la collecte automatisée sans autorisation expresse. Conserver le lien vers la recherche publique ; demander un accord avant un connecteur. |

La page du 116 000 explique que les avis de recherche concernant les enfants ne sont diffusés qu'après autorisations spécifiques et que les avis sont retirés lorsque l'enfant est retrouvé. Le catalogue Leanna conserve donc la provenance et ne copie pas les images. Un élément absent du flux RSS n'est jamais marqué automatiquement comme « retrouvé » ou « retiré » : les flux sont souvent limités aux publications récentes et l'absence ne prouve rien.

## Sécurité et confidentialité

- Seules les métadonnées exposées dans le flux public sont collectées automatiquement ; pas de téléchargement d'image, de crawl des profils ou de données privées.
- Les URLs sont limitées au domaine officiel, en HTTPS ; les redirections sont refusées par le connecteur RSS.
- Le catalogue est accessible aux utilisateurs authentifiés ; les fiches d'enquête restent isolées par notebook avec RLS.
- Toute publication importée est `pending_review` et `unverified`. Une personne autorisée doit examiner la fiche avant toute validation.
- Aucune identification automatique, fusion d'homonymes, inférence de localisation ou conclusion d'enquête.
- L'absence d'un élément dans une synchronisation ne déclenche jamais un statut de disparition/résolution.

## Cycle de vie

- `pending_review` : fiche créée, revue humaine requise.
- `unverified` : publication non confirmée manuellement.
- `active` : présence confirmée manuellement.
- `changed` : contenu de la publication source modifié.
- `removed` / `unavailable` : statut signalé par un éditeur ; jamais déduit de la simple absence dans un flux.
- Les révisions structurées conservent un instantané JSON et une empreinte SHA-256.

## Exploitation

La veille automatique tourne dans `apps/worker/src/main.ts`. Elle ne fonctionne que si le worker est démarré, si la migration `20261111110000_missing_person_notice_automation.sql` est appliquée et si la source RSS est accessible depuis l'environnement worker. En cas d'échec, le connecteur conserve le message d'erreur, libère son bail et réessaie après un délai d'une heure.

Le flux est actuellement vérifié toutes les 15 minutes. La première synchronisation peut prendre jusqu'à 15 minutes après le démarrage du worker. Les connecteurs ARPD et INTERPOL doivent être activés séparément après vérification technique et juridique.
