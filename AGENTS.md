# Project instructions

- Read `PRODUCT.md`, `DESIGN.md` and `.impeccable/surfaces/cines-redesign.md` before UI changes.
- Preserve source facts. Never invent film metadata, cinema addresses, prices, ratings, reviews or booking availability.
- `data/cines.json` is the last known snapshot. Production builds fetch the published Web-scrapping JSON and fall back to this file.
- Keep this project static: no application backend, database, runtime API or client-side-only SEO content.
- Keep dependencies at zero unless a concrete requirement cannot be met with Node/browser primitives.
- Keep source showtime strings intact. Do not parse or rewrite them as exact time values.
- Every route must be generated as HTML during `npm run build` and included in `dist/`.
- Run `npm test`, `npm run build`, and Playwright browser smoke checks at 1440, 1024, 768, 390 and 360 px before shipping.
- Keep all project changes in one final commit on `main`; do not create progress commits.
