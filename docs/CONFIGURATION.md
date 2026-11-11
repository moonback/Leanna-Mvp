# Configuration

Les variables ci-dessous sont lues côté web ou worker. Renseignez uniquement les services utilisés par votre environnement. Les clés secrètes doivent rester dans les environnements serveur.

## Web

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase exposée au navigateur |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase ; la sécurité repose aussi sur Auth et RLS |
| `SUPABASE_URL` | URL Supabase côté serveur |
| `SUPABASE_ANON_KEY` | Clé publique utilisée côté serveur |
| `SUPABASE_SERVICE_ROLE_KEY` | Accès privilégié serveur ; ne jamais exposer au navigateur |
| `OPENROUTER_API_KEY` | Accès aux modèles de chat et génération |
| `OPENROUTER_CHAT_MODEL` | Identifiant du modèle de chat |
| `OPENROUTER_EMBEDDINGS_MODEL` | Modèle d'embeddings OpenRouter si utilisé |
| `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_API_KEY` | Fournisseur et modèle d'embeddings |
| `GEMINI_API_KEY` | Mode vocal Gemini Live |
| `TAVILY_API_KEY` | Recherche web Fast Research |
| `DEEPGRAM_API_KEY`, `STT_MODEL`, `STT_LANGUAGE` | Transcription vocale |
| `APP_URL`, `BILLING_MODE` | URL publique et mode de facturation |
| `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_EMAIL` | Mentions légales |

## Worker

Le modèle de fichier disponible est `apps/worker/.env.example`. Il documente notamment :

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_ID`
- `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_API_KEY`
- `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL`
- `TAVILY_API_KEY`
- `DEEPGRAM_API_KEY`, `STT_MODEL`, `STT_LANGUAGE`
- `ELEVENLABS_API_KEY`, `AUDIO_OVERVIEW_TTS_MODEL`, `AUDIO_OVERVIEW_HOST_VOICE_ID`, `AUDIO_OVERVIEW_GUEST_VOICE_ID`, `FFMPEG_PATH`

## Cohérence des embeddings

Le web et le worker doivent utiliser le même espace vectoriel et une dimension compatible avec le schéma de base. La configuration du projet indique 1024 dimensions. Ne changez pas de fournisseur ou de modèle sans vérifier la dimension des vecteurs, l'ingestion et la recherche existante.

## Sécurité

- Ne commitez jamais `.env`, `.env.local` ou des secrets.
- N'utilisez jamais `NEXT_PUBLIC_` pour une clé privée.
- La clé Supabase service role doit être exclusivement utilisée dans du code serveur de confiance.
- Limitez les secrets aux environnements qui en ont besoin et faites tourner toute clé exposée.
- Les variables optionnelles doivent être renseignées uniquement si la fonctionnalité correspondante est activée.

La liste est issue des manifestes, du README racine et de l'exemple worker présents dans le dépôt. Elle ne remplace pas la lecture des appels `process.env` lors d'un audit de déploiement complet.
