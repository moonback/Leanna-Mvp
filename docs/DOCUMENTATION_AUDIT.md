# Audit documentaire — état de main au 11 novembre 2026

## Périmètre

Audit distant du dépôt `moonback/Leanna-Mvp`, branche `main`, commit de référence `402135d7b72f5fa82e706f31c3f78ed9b1657f38`.

L'audit a vérifié l'arborescence Git, le README racine, les manifestes pnpm, la configuration Supabase, les workflows GitHub Actions, les prompts d'enquête et les principaux handlers d'extraction/recoupement. Il n'a pas exécuté le code, les migrations, les tests ni l'application.

## Constats corrigés dans cette branche

1. **Workflow CI absent.** Le seul workflow préexistant publiait le client desktop sur tag. Un workflow de validation est ajouté dans `.github/workflows/ci.yml` pour exécuter typecheck, tests, lint web, démarrage Supabase et pgTAP.
2. **Liens README cassés.** Le README référençait des documents inexistants à la racine de `docs/`. Un index et les guides Architecture, Installation, Configuration, Structure et Audit sont ajoutés.
3. **URL de clonage obsolète.** Le README pointait vers `moonback/leanna-notebook` au lieu de `moonback/Leanna-Mvp`.
4. **Documentation web générique.** `apps/web/README.md` reste le README initial de Next.js ; le README racine et les guides `docs/` sont les références projet.

## Limites produit/techniques confirmées dans le README ou les fichiers inspectés

- Le mode vocal utilise Gemini Live ; le README indique que Roxane est désactivée par défaut et que les deux premiers échanges sont silencieux.
- L'OCR des PDF scannés n'est pas confirmé.
- Le mode de facturation est simulé par défaut selon la documentation existante.
- Le connecteur Google Drive de bout en bout n'est pas confirmé.
- Le parcours Fast Research et la publication/mise à jour Electron n'ont pas été retestés dans cet audit.
- La résolution d'homonymes, les relations persistantes entre entités et les vues chronologiques avancées restent à développer selon la vision produit.

## Points de vigilance d'ingénierie

- Les migrations Supabase contiennent des préfixes de version répétés (notamment `20261110000000` et `20261110040000`). La compatibilité de ces versions avec l'historique Supabase doit être vérifiée par `pnpm db:reset` et `pnpm db:test` avant tout déploiement. Ne renommez pas une migration déjà appliquée sur un environnement partagé sans vérifier son historique.
- Les routes d'extraction et de recoupement vérifient le rôle éditeur avant d'utiliser le client service. Les fonctions SQL privilégiées doivent rester non exécutables par les rôles client.
- Le worker de recoupement limite actuellement la sélection à 500 lignes par catégorie, puis à 120 éléments pour l'analyse. Une stratégie de pagination/fenêtrage sera nécessaire pour les dossiers volumineux.
- Le recoupement demande à l'IA de ne pas assimiler la répétition d'une même déclaration à une corroboration indépendante. La provenance des documents copiés/dérivés doit toutefois être modélisée explicitement pour rendre cette règle vérifiable par le code.
- La validation d'un extrait confirme sa présence dans une pièce, pas la véracité du contenu rapporté.

## Vérifications à effectuer

Le workflow CI ajouté doit fournir les premiers résultats automatiques. À ce stade, aucun résultat de typecheck, lint, tests Vitest, build desktop, migration ou pgTAP n'est revendiqué dans cet audit. Vérifier les logs GitHub Actions après le premier push de cette branche.

## Principes de sécurité

Leanna est un outil d'aide à l'analyse documentaire, pas un outil de surveillance ou de décision. Les hypothèses et pistes doivent rester distinguées des faits consignés ; toute validation est humaine. Les accès aux dossiers doivent rester limités aux personnes autorisées et les données doivent être traitées selon une base légale et une politique de conservation adaptée.
