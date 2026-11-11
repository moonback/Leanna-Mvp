# Structure du dépôt

```text
.
├── .github/workflows/       # CI et publication desktop
├── apps/
│   ├── web/                 # Application Next.js, API, UI et prompts
│   ├── worker/              # Jobs asynchrones, ingestion et traitements IA
│   └── desktop/             # Client Electron, preload, packaging et tests
├── packages/
│   └── core/                # Utilitaires partagés, notamment citations
├── supabase/
│   ├── migrations/          # Évolutions SQL versionnées
│   ├── tests/               # Tests pgTAP
│   ├── config.toml          # Configuration Supabase locale
│   └── seed.sql             # Données de démarrage local
├── docs/
│   ├── architecture/
│   ├── audits/
│   └── technical/
└── README.md
```

## Responsabilités

- `apps/web/app` : routes Next.js, pages et API HTTP.
- `apps/web/lib` : accès Supabase, validation, logique API et prompts.
- `apps/worker/src/ingest` : ingestion et préparation des sources.
- `apps/worker/src/investigation` : extraction et recoupement d'éléments d'enquête.
- `apps/worker/src/studio` : génération d'artefacts et Audio Overview.
- `apps/desktop/src` : processus principal Electron, preload et API desktop partagée.
- `packages/core/src` : logique partagée indépendante des applications.

Les répertoires peuvent évoluer ; utilisez les manifestes de chaque package pour connaître les scripts disponibles.
