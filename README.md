# Episodic

Browse IMDb episode ratings for any TV show at a glance. Search for a series and see every episode rendered as a color-coded cell — green for great, red for rough — grouped by season with hover tooltips showing titles, air dates, and ratings.

## Tech stack

- **Next.js 14** — App Router, server components, ISR
- **TypeScript**
- **Tailwind CSS**
- **OMDb API** — show metadata and per-episode ratings

## Running locally

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/episodic.git
cd episodic
npm install
```

### 2. Add your OMDb API key

Free keys are available at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx).

Edit `.env.local`:

```
OMDB_API_KEY=your_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  page.tsx                 Homepage — debounced search via /api/search
  api/search/route.ts      Search route (keeps API key server-side)
  show/[slug]/page.tsx     Show page — ratings grid, JSON-LD, Open Graph
  sitemap.ts               Auto-serves /sitemap.xml
  robots.ts                Auto-serves /robots.txt
components/
  AdUnit.tsx               Ad placeholder component (swap for real AdSense later)
lib/
  omdb.ts                  All OMDb API calls and TypeScript types
  featured-shows.ts        Pre-rendered show list — add IMDb IDs here
```

## Adding more pre-rendered shows

Edit `lib/featured-shows.ts` and add the IMDb ID. The show will be included in
the sitemap and statically generated at the next build — no other changes needed.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OMDB_API_KEY` | Yes | From omdbapi.com |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your production URL, e.g. `https://episodic.app` |
