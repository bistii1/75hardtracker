# 75 Hard Tracker

A shared 75 Hard tracker for you and Karthik, starting June 8, 2026.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Supabase environment variables, local progress is saved to
`data/progress.json`.

## Deploying On Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel as a Next.js project.
3. Create a free Supabase project at `https://supabase.com`.
4. In Supabase, open **SQL Editor** and run:

```sql
create table if not exists public.challenge_progress (
  id text primary key,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_challenge_progress_updated_at on public.challenge_progress;

create trigger set_challenge_progress_updated_at
before update on public.challenge_progress
for each row
execute function public.set_updated_at();
```

5. In Supabase, go to **Project Settings** → **API** and copy:
   - Project URL
   - `service_role` secret key
6. In Vercel, add these environment variables:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Keep `SUPABASE_SERVICE_ROLE_KEY` secret. It is only used by the server API route
and is not exposed to the browser.

Once deployed, both of you can open the same Vercel URL and update the shared
calendar.
