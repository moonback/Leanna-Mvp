# Architecture technique

## Vue d'ensemble

Leanna est une application SaaS multi-utilisateur composée de quatre blocs principaux :

- **Web** — Next.js App Router et React dans `apps/web`. Gère l'interface, l'authentification côté serveur, les API et l'accès aux dossiers.
- **Worker** — Node.js/TypeScript dans `apps/worker`. Consomme les jobs persistés et exécute les traitements asynchrones : ingestion, embeddings, génération de contenus, audio et analyse d'enquête.
- **Données** — Supabase PostgreSQL, Auth et Storage privé. Les politiques RLS isolent les données par espace et dossier ; les opérations privilégiées passent par le serveur ou le worker.
- **Desktop** — Electron dans `apps/desktop`. Le client charge le SaaS via HTTPS ; il ne remplace ni le backend ni Supabase.

Le paquet `packages/core` contient les utilitaires partagés de résolution des citations.

## Flux des traitements

1. L'utilisateur importe une source dans un dossier.
2. L'API authentifie l'utilisateur et vérifie son rôle sur le dossier.
3. Les métadonnées et fichiers sont conservés dans Supabase.
4. Les traitements longs sont enregistrés sous forme de jobs.
5. Le worker récupère les jobs, traite les sources et persiste les résultats.
6. L'interface lit les états et affiche les résultats avec leurs références documentaires.

## Analyse d'enquête

Les tables métier `investigation_entities`, `investigation_events`, `investigation_statements`, `investigation_leads` et `investigation_lead_evidence` stockent les éléments structurés et leurs liens aux sources. Les clés étrangères composites empêchent de rattacher un élément à une source d'un autre dossier.

L'extraction est déclenchée explicitement par un éditeur. Les citations générées doivent correspondre au texte source. Le recoupement exige plusieurs sources distinctes et conserve les éléments contraires. Les pistes restent au statut proposé jusqu'à une revue humaine.

## Frontières de sécurité

- Les contrôles de rôle sont exécutés dans les Route Handlers.
- RLS protège les lectures depuis les clients utilisateur.
- Les écritures métier privilégiées passent par des handlers authentifiés.
- Les clés de service et clés fournisseurs restent côté serveur/worker.
- Les documents importés sont des données non fiables et ne peuvent pas remplacer les instructions système.
- Une mention vérifiée signifie que l'extrait a été retrouvé dans la pièce ; elle ne certifie pas la véracité de l'affirmation rapportée.

## Exécution

Les commandes et prérequis sont détaillés dans [Installation](INSTALLATION.md). Les noms des variables sont recensés dans [Configuration](CONFIGURATION.md).

Cette description reflète la structure et les fichiers présents dans le dépôt ; elle ne vaut pas preuve d'un déploiement ou d'une validation opérationnelle.
