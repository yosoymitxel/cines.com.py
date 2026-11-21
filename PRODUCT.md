# Product

## Surface
Independent redesign proposal for the Paraguayan cinema listing currently published by Cines.com.py.

## Audience
People in Paraguay choosing a film, cinema and session time, primarily from mobile devices.

## Visitor job
Find a film, compare the cinemas where it is playing, understand the published showtime text, and continue to the original cinema source for confirmation or ticketing.

## Proof and content
The panel's published `data/cines.json` is the source of current film posters, titles, genres, official film URLs, cinema names and raw showtime strings. The official Cines.com.py site is the source for additional public content when it can be fetched and attributed. Missing fields remain absent.

## Main action
Find a session and open the corresponding official film page.

## Constraints
- No custom backend, database, account system or runtime API.
- Static HTML output for every indexable route.
- Refresh current listings from the panel's JSON during scheduled GitHub Actions builds (every six hours).
- Clearly identify the work as an independent concept, not an official Cines.com.py service.
- No copied logos, fabricated reviews, invented metadata, invented prices or false ticket purchase controls.
- Retain the original source URL on each movie page.
