# Installation et développement local

## Prérequis

- Node.js 24
- pnpm 10.4.1 (version utilisée par le workflow de publication desktop)
- Docker Desktop démarré pour Supabase local
- Git
- ffmpeg accessible dans le PATH pour le pipeline Audio Overview

## Récupération du dépôt

```bash
git clone https://github.com/moonback/Leanna-Mvp.git
cd Leanna-Mvp
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
```

## Configuration

Copiez `apps/worker/.env.example` vers `apps/worker/.env`, puis renseignez les variables nécessaires au worker. Créez `apps/web/.env.local` pour les variables web ; aucun fichier `apps/web/.env.example` n'est présent dans le dépôt audité.

Voir [Configuration](CONFIGURATION.md). Ne placez jamais de clé privée dans une variable préfixée par `NEXT_PUBLIC_`.

## Démarrer Supabase

Docker doit être actif :

```bash
pnpm db:start
```

Les ports locaux sont configurés dans `supabase/config.toml` : API 58321, PostgreSQL 58322, Studio 58323 et interface mail de test 58324.

Pour réinitialiser la base locale et rejouer les migrations :

```bash
pnpm db:reset
```

**Attention :** cette commande est destructive pour la base Supabase locale.

## Lancer l'application

Dans un premier terminal :

```bash
pnpm dev
```

Dans un second terminal :

```bash
pnpm --dir apps/worker start
```

L'application web est disponible sur http://localhost:3000.

Pour le client Electron, consulter [apps/desktop/README.md](../apps/desktop/README.md).

## Vérifications

```bash
pnpm typecheck
pnpm test
pnpm --dir apps/web lint
pnpm db:test
```

Les tests de base de données nécessitent que Supabase local soit démarré. Le workflow GitHub Actions `.github/workflows/ci.yml` exécute ces vérifications automatiquement sur les pushs ciblés et les pull requests vers `main`.
