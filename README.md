# 75 Hard Tracker

A shared 75 Hard tracker for you and Karthik, starting June 8, 2026.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Redis environment variables, local progress is saved to `data/progress.json`.

## Deploying On Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel as a Next.js project.
3. Add a Redis database from the Vercel Marketplace, or connect an existing Upstash Redis database.
4. Make sure Vercel has these environment variables:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The app also supports the older Vercel KV variable names, `KV_REST_API_URL` and
`KV_REST_API_TOKEN`, if those are what Vercel provides.

Once deployed, both of you can open the same Vercel URL and update the shared
calendar.
