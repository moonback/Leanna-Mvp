# Application web Leanna

Cette application Next.js constitue l'interface SaaS de Leanna Notebook : authentification, dossiers d'enquête, sources documentaires, analyse conversationnelle, Studio et paramètres.

Le guide de référence du dépôt se trouve à la racine :

- [README principal](../../README.md)
- [Installation locale](../../docs/INSTALLATION.md)
- [Configuration](../../docs/CONFIGURATION.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Vision produit et garde-fous d'enquête](../../docs/PRODUCT_VISION.md)

## Commandes depuis la racine

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test
```

L'application est servie sur http://localhost:3000. Supabase doit être configuré et démarré pour les parcours qui accèdent aux données.
