# Leanna — plateforme documentaire pour enquêtes sur personnes disparues

Leanna transforme chaque notebook en **dossier d’enquête documentaire**. Les équipes autorisées y centralisent avis de recherche, rapports, témoignages, photos et autres pièces, puis interrogent le corpus pour retrouver les éléments pertinents, comparer les versions, reconstruire une chronologie et préparer des pistes à vérifier. Chaque réponse renvoie aux passages d’origine.

Leanna Notebook est une application SaaS multi-utilisateur fondée sur Next.js, Supabase et un worker Node. Le dépôt contient également un client desktop Electron. Le projet est en développement actif ; les états ci-dessous distinguent les capacités repérées dans le code des validations opérationnelles qui restent à effectuer.

## Fonctionnalités

| Domaine | Capacités repérées dans le code | Réserve |
|---|---|---|
| Dossiers d’enquête | Organisation documentaire, membres, liens de partage, visites et copie | Le modèle de données conserve le nom technique `notebooks` ; le parcours métier est en cours de spécialisation |
| Sources | Import, traitement, sélection, recherche et citations | OCR des PDF scannés non confirmé |
| Analyse d’enquête | Chat streaming, citations, extraction IA contrôlée des entités/événements/déclarations et recoupement multi-sources proposant des pistes sourcées | Les pistes restent des propositions à valider humainement ; aucune fusion automatique d’identités ni conclusion d’enquête |
| Studio | Rapports, fiches, quiz, cartes mentales, infographies, chronologies, comparatifs, glossaires, FAQ, diagrammes, contenus éditoriaux et plans d'étude | 13 types acceptés par l'API ; résultats visuels non validés exhaustivement |
| Audio Overview | Script dialogué à deux voix, TTS segmenté, mixage ffmpeg et MP3 privé | Nécessite les identifiants TTS et ffmpeg sur le worker |
| Mode vocal | Gemini Live, recherche RAG, Leanna et co-animatrice Roxane | Roxane est désactivée par défaut ; deux premiers échanges silencieux |
| Prompts système | Catalogue éditable par utilisateur ; consignes spécialisées pour analyse de dossier, rapport, chronologie, comparaison et briefings vocaux | Les règles fixes de prudence et de citation sont ajoutées côté serveur pour le chat ; les prompts personnalisés des autres tâches doivent être revus progressivement |
| Modèles IA | Catalogue OpenRouter et préférences par fonctionnalité | Dépend de la clé OpenRouter |
| Fast Research / Découvrir | Routes de recherche, import de résultats et ouverture de découvertes | Parcours complet non retesté ici |
| Electron | Client desktop, configuration de build et dépendance electron-updater | Installation et mise à jour non validées dans cette passe |
| Facturation réelle | Mode de facturation configurable | README et code de configuration indiquent un mode simulé par défaut |
| Google Drive | Type de source prévu dans le modèle de données | Connecteur de bout en bout non confirmé |
| Présentations | Type `slide_deck` présent dans l'enum SQL | Non accepté par le schéma de création Studio inspecté |

Le statut « repéré dans le code » ne signifie pas qu'une fonctionnalité a été testée en production. Voir le [rapport d'audit](docs/DOCUMENTATION_AUDIT.md).

## Principes de traitement des informations d’enquête

- Un document qui rapporte une information prouve que celle-ci est consignée, pas nécessairement qu’elle est vraie.
- Les réponses distinguent faits documentés, déclarations/témoignages, informations non vérifiées, hypothèses, pistes et contradictions.
- Chaque affirmation issue du corpus doit citer ses passages ; les références ne doivent jamais être inventées.
- Une piste IA n’est ni une preuve ni une conclusion. Toute vérification et toute décision restent sous contrôle humain et, lorsque nécessaire, des autorités compétentes.
- Aucune personne ne doit être accusée sur la base d’une corrélation, d’une rumeur ou d’une inférence non vérifiée.
- Les données du dossier sont confidentielles ; leur diffusion nécessite une autorisation et un cadre approprié.

## Architecture technique

- **Web :** Next.js 15.5.29, React 19.1.0, TypeScript, Tailwind CSS 4, Radix UI.
- **Worker :** Node.js 24, TypeScript natif, traitements asynchrones persistés en base.
- **Données :** Supabase PostgreSQL 17, Auth, Storage privé, RLS, pgvector et recherche plein texte.
- **IA :** OpenRouter, Gemini Live, Deepgram, ElevenLabs, Tavily ; Voyage et Mistral sont également prévus comme options d'embeddings.
- **Desktop :** Electron 38, electron-builder, electron-updater.
- **Code partagé :** `packages/core` pour la résolution des citations.

```mermaid
flowchart LR
  U[Utilisateur] --> WEB[apps/web - Next.js]
  WEB --> AUTH[Supabase Auth]
  WEB --> DB[(PostgreSQL / RLS)]
  WEB --> ST[Supabase Storage]
  DB --> JOBS[File jobs]
  JOBS --> WK[apps/worker - Node]
  WK --> DB
  WK --> AI[OpenRouter et services IA]
  CORE[packages/core] --> WEB
  CORE --> WK
  DESK[apps/desktop - Electron] --> WEB
```

Le worker consomme les jobs persistés en base. Le système décrit dans le code utilise des jobs, quotas et états de progression. Voir [Architecture](docs/ARCHITECTURE.md).

## Démarrage local

### Prérequis
- Node.js 24
- pnpm
- Docker pour Supabase local
- ffmpeg pour le pipeline Audio Overview

### Installation
```bash
git clone https://github.com/moonback/leanna-notebook.git
cd leanna-notebook
pnpm install
pnpm db:start
```

Configurez les variables web et worker. Le README précédent référençait `apps/web/.env.example`, dont l'existence n'a pas été confirmée lors de l'audit distant. L'exemple worker accessible est `apps/worker/.env.example`.

### Lancement
Terminal 1 :
```bash
pnpm dev
```

Terminal 2 :
```bash
pnpm --dir apps/worker start
```

Web : http://localhost:3000. Supabase local : API 58321, PostgreSQL 58322, Studio 58323, boîte mail de test 58324.

Pour réinitialiser la base locale (opération destructive) : `pnpm db:reset`.

Voir [Installation](docs/INSTALLATION.md) et [Configuration](docs/CONFIGURATION.md).

## Variables d'environnement

Les variables principales sont :

| Variable | Utilité |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Connexion web à Supabase |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Accès Supabase serveur/worker |
| `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL` | Chat et génération |
| `OPENROUTER_EMBEDDINGS_MODEL`, `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_API_KEY` | Embeddings |
| `GEMINI_API_KEY` | Gemini Live |
| `TAVILY_API_KEY` | Fast Research |
| `DEEPGRAM_API_KEY`, `STT_MODEL`, `STT_LANGUAGE` | Transcription audio |
| `ELEVENLABS_API_KEY`, `AUDIO_OVERVIEW_HOST_VOICE_ID`, `AUDIO_OVERVIEW_GUEST_VOICE_ID`, `FFMPEG_PATH` | Audio Overview |
| `APP_URL`, `BILLING_MODE` | URL publique et mode de facturation |
| `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_EMAIL` | Informations des pages légales |

La liste complète et les variables worker sont détaillées dans [Configuration](docs/CONFIGURATION.md). Ne versionnez jamais de secrets. Web et worker doivent utiliser des embeddings compatibles de même dimension (1024 selon la configuration décrite).

## Scripts

| Commande | Fonction |
|---|---|
| `pnpm dev` | Démarrer le web |
| `pnpm --dir apps/worker start` | Démarrer le worker |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Tests Vitest des packages |
| `pnpm db:start` / `pnpm db:reset` | Supabase local |
| `pnpm db:test` | Tests pgTAP |
| `pnpm desktop:dev` | Client Electron en développement |
| `pnpm desktop:build` / `pnpm desktop:dist:win` | Build desktop / Windows |

Ces commandes proviennent des manifestes du dépôt ; elles n'ont pas été exécutées pendant cette passe distante.

## Documentation

L'index de référence est [docs/README.md](docs/README.md).

Documents importants :
- [Vision produit — enquêtes sur personnes disparues](docs/PRODUCT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Référence API](docs/API_REFERENCE.md)
- [Base de données](docs/DATABASE.md)
- [Catalogue des prompts IA](docs/AI_PROMPTS_CATALOG.md)
- [Gestion des prompts](docs/features/SYSTEM_PROMPTS.md)
- [Mode vocal](docs/features/VOICE_MODE.md)
- [Studio](docs/features/STUDIO.md)
- [Guide utilisateur](docs/user-guide/GETTING_STARTED.md)
- [Audit documentaire](docs/DOCUMENTATION_AUDIT.md)

## État de la réorientation produit

Cette branche ajoute les fondations métier du dossier d’enquête : entités mentionnées, événements, déclarations et pistes persistées, chacune rattachée à une source du même dossier. Le panneau permet la saisie, la revue humaine et le lancement explicite d’une extraction IA par lots. Les extraits IA ne sont enregistrés que s’ils correspondent exactement au texte source ; les traitements sont idempotents et journalisés. Les relations entre entités, le recoupement multi-sources automatique, la résolution des homonymes et la génération assistée de pistes restent des étapes ultérieures.

## Contribution

1. Créer une branche dédiée depuis `main` (par exemple `feat/...`, `fix/...` ou `docs/...`).
2. Garder les changements ciblés et ajouter/adapter les tests pertinents.
3. Exécuter `pnpm typecheck`, `pnpm lint`, `pnpm test` et, pour les changements SQL, `pnpm db:test`.
4. Ouvrir une Pull Request vers `main avec le périmètre, les tests exécutés et les limites connues.

La structure est organisée autour de `apps/web`, `apps/worker`, `apps/desktop`, `packages/core` et `supabase`. Voir [Structure du projet](docs/PROJECT_STRUCTURE.md).

## Licence

Aucun fichier `LICENSE` n'a été trouvé à la racine via l'API GitHub lors de la première passe. La licence du projet doit être confirmée avant toute redistribution ; aucune licence n'est présumée ici.

---

**État documentaire :** la documentation décrit désormais plusieurs fonctionnalités confirmées dans le code, mais les validations locales et l'audit exhaustif des handlers restent à faire. Consulter [docs/DOCUMENTATION_AUDIT.md](docs/DOCUMENTATION_AUDIT.md).
