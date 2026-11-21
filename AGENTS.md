# Project instructions

- Read `PRODUCT.md`, `DESIGN.md` and `.impeccable/surfaces/cines-redesign.md` before UI changes.
- Preserve data accuracy. Never invent film metadata, cinema addresses, prices, ratings, reviews or booking availability.
- Cines PY is the final public website, never describe it as a proposal, clone, parallel or unofficial site.
- No UI links, redirects, disclaimers or copy that send visitors to or refer them to another cinema website.
- Use Font Awesome for interface icons; do not use Unicode arrows or hand-drawn icon substitutes.
- `data/cines.json` is the last known snapshot. Production builds fetch the published Web-scrapping JSON and fall back to this file.
- Keep this project static: no application backend, database, runtime API or client-side-only SEO content.
- Keep dependencies at zero unless a concrete requirement cannot be met with Node/browser primitives.
- Keep source showtime strings intact. Do not parse or rewrite them as exact time values.
- Every route must be generated as HTML during `npm run build` and included in `dist/`.
- Run `npm test`, `npm run build`, and Playwright browser smoke checks at 1440, 1024, 768, 390 and 360 px before shipping.
- Keep all project changes in one final commit on `main`; do not create progress commits.

- Apply the Anti-slop UI gate in `docs/ANTI-SLOP-UI.md` during every visual change.
- Use `DESIGN.md` as visual source of truth and `docs/DESIGN-SKILLS.md` for animation and polish reviews.
- Preserve GitHub Pages subpath compatibility: `SITE_URL` is origin-only and `BASE_PATH` is the project path.
- Before shipping, run build, static tests, Playwright responsive checks and review generated screenshots. Report unverified checks honestly.
- Follow `docs/SEO-CHECKLIST.md` for metadata, structured data, crawlability and Core Web Vitals reporting.
