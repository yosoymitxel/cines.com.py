# Cines PY — design system

## Product and surface

An independent, static proposal for a more useful Paraguayan cinema programme. The main task is operational: visitors need to locate a film, compare cinemas, understand each published session string and continue to the source that can confirm availability or sell tickets.

The interface is a programme and wayfinding system, not a streaming catalogue and not a ticketing app. It must never imply that a session is bookable here.

## Visual thesis

Translate the printed cinema programme into a responsive digital index. A reader should recognise the hierarchy of a well-edited programme: what's showing, where, at what published times, and where to confirm the details.

The design uses material contrast and typographic hierarchy instead of film-reel clichés, generic cinema marquee decoration, purple-blue gradients, glowing outlines or a wall of identical rounded cards.

## Palette

| Token | Value | Purpose |
|---|---|---|
| Ink | `#10231F` | Masthead, large dark fields, primary text on light |
| Mineral paper | `#EEF0E8` | Main reading surface |
| Phosphor lime | `#D9EF61` | A single high-attention action and small programme markers |
| Muted ink | `#5B665E` | Supporting text on mineral paper |
| White | `#FFFFFF` | Clear text on ink and clean poster grounds |

The phosphor accent is deliberately sparse. It marks primary action and selection, not every link, border and icon.

## Typography

Use the system font stack so the site does not depend on a third-party font request. Display titles use a compact, heavy sans voice; body copy prioritises readable shapes and stable line wrapping. Programme indexes, dates and showtime strings use tabular numerals where available. Long prose stays in a restrained reading measure.

## Composition

- The home first viewport is a two-part programme opener: the lead film and poster, balanced by a short list of other titles.
- The current catalogue prioritises scanning, fast search and genre filtering over ornamental cards.
- A film detail makes the poster, title and published showtime groups easy to understand without hiding source text.
- A cinema detail starts with the cinema name and its current programme.
- The venue directory is grouped only where the location is apparent in the source name. Unknown geography remains unlabelled rather than guessed.
- Ticket-edge rules separate programme groups; they are a structural motif, not a general decoration.

## Components and interaction

- One compact navigation system; on small screens it collapses behind a labelled button with `aria-expanded` and Escape-to-close behavior.
- Film cards keep source posters and lead to static film pages.
- Search is local to the current static catalogue and supports title and genre text.
- Genre chips are multi-state filters with `aria-pressed` values and an announced result count.
- External official links open in a new tab with `noopener noreferrer`.
- Missing poster assets produce an accessible text fallback. Missing source facts remain missing.

## Motion and responsive behavior

Motion is limited to short hover/focus feedback and native scroll behavior. No endless loops, parallax, autoplay, scroll-jacking or information hidden behind animation. `prefers-reduced-motion` removes nonessential transitions.

The composition is checked at 1440, 1024, 768 and 390 CSS pixels; a 360-pixel smoke check is also included. Layout must not create horizontal overflow or truncate primary controls.

## Accessibility

- Spanish (`es-PY`) document language, one primary `h1` per page and ordered heading levels.
- Visible keyboard focus, skip link, meaningful image alternatives and labelled search.
- Filter state is programmatically exposed; empty search results are announced.
- Text and controls use contrast-safe pairings, including muted text on the mineral background.
- No interaction relies on hover alone.

## Content truth and SEO

- The panel's `data/cines.json` supplies current movies, posters, genres, official movie URLs, cinema names and raw session strings.
- The Cines.com.py upcoming releases page supplies release dates and synopses when it can be fetched; a committed snapshot is the fallback.
- Cinema addresses, prices, runtimes, ratings, cast, reviews and availability are never invented. Official-source pages are linked so visitors can verify the current facts.
- Every indexable route is rendered as HTML at build time, with a unique title, description and canonical URL. Movie and cinema pages include applicable Schema.org data; the catalogue and sitemap use static internal routes.
- The page is visibly independent and disclaims official affiliation in the footer and contact section.

## Runtime constraints

Node.js built-ins only at build time. No application backend, database, account system, external component framework, runtime API or mandatory remote font. GitHub Actions refreshes the static output every six hours and deploys it to GitHub Pages.
