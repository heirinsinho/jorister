# Lusi-Hits

Next.js app for scanning Spotify track QR codes and playing them through Spotify Web Playback.

## Environment

Create a local environment file. Docker Compose will read either `.env` or `.env.local`; `.env.local` overrides `.env` when both exist.

```bash
cp .env.example .env.local
```

Fill in the Spotify app credentials:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=replace_with_a_random_secret
```

For local development, the Spotify app must allow this redirect URI:

```text
http://127.0.0.1:3000/api/auth/callback/spotify
```

You can generate a local `NEXTAUTH_SECRET` with:

```bash
openssl rand -base64 32
```

## Getting Started

First, build and run the development container:

```bash
docker compose up --build
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) with your browser to see the result.

<<<<<<< HEAD
## QR codes

Generate persistent PNG QR codes from URLs:

```bash
uv sync
uv run jorister-qr https://example.com
# or
npm run generate:qr -- https://example.com
```

Generated images are written to `public/qr` with deterministic filenames, so the same URL keeps the same PNG path.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.
=======
The app runs Next.js inside Docker, including npm install. You do not need Node.js or npm installed on the host machine.
>>>>>>> 4b9d26eeb79df35e65afe9ec8f7899745198bab3

## Linting

```bash
docker compose run --rm web npm run lint
docker compose run --rm web npm run lint:fix
```

## Production Image

Build and run the production image locally:

```bash
docker compose -f compose.prod.yaml up --build
```
