import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { extractUpcoming, isFutureRelease } from './upcoming.mjs';
import { extractCinemaLinks, extractCinemaPageData } from './official.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const required = [
  'index.html', 'cartelera/index.html', 'estrenos/index.html', 'salas/index.html',
  'contacto/index.html', 'sitemap.xml', 'robots.txt', 'feed.xml', 'assets/main.css', 'assets/redesign.css', 'assets/main.js'
];
for (const file of required) await fs.access(path.join(dist, file));
const data = JSON.parse(await fs.readFile(path.join(root, 'data/cines.json'), 'utf8'));
assert.ok(Array.isArray(data.movies) && data.movies.length > 0, 'snapshot must contain movies');
const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
assert.match(html, /<html lang="es-PY">/);
assert.ok(html.includes('https://yosoymitxel.github.io/cines.com.py/'), 'canonical must include the GitHub Pages project path once');
assert.ok(!html.includes('/cines.com.py/cines.com.py/'), 'canonical must not duplicate the project path');
assert.ok(html.includes('property="og:locale" content="es_PY"'));
assert.ok(html.includes('name="twitter:image"'));
assert.ok(html.includes('assets/redesign.css'));
assert.ok(html.includes('font-awesome/6.7.2/css/all.min.css'), 'Font Awesome must be loaded');
assert.ok(!/href=["']https?:\/\/(?:www\.)?cines\.com\.py/i.test(html), 'homepage must not link to another cinema website');
assert.doesNotMatch(html, /propuesta independiente|no es un sitio oficial|no está afiliado/i);
for (const route of ['cartelera/index.html', 'estrenos/index.html', 'salas/index.html', 'contacto/index.html']) {
  const page = await fs.readFile(path.join(dist, route), 'utf8');
  assert.doesNotMatch(page, /href=["']https?:\/\/(?:www\.)?cines\.com\.py/i, `external cinema redirect in ${route}`);
  assert.doesNotMatch(page, /propuesta independiente|no es un sitio oficial|no está afiliado/i, `parallel-site disclaimer in ${route}`);
}
const schemaMarker = '<script type="application/ld+json">';
const schemaStart = html.indexOf(schemaMarker) + schemaMarker.length;
const schemaEnd = html.indexOf('</script>', schemaStart);
const structuredData = JSON.parse(html.slice(schemaStart, schemaEnd));
assert.equal(structuredData['@context'], 'https://schema.org');
const visualCss = await fs.readFile(path.join(dist, 'assets/redesign.css'), 'utf8');
assert.ok(visualCss.includes('prefers-reduced-motion'));
assert.ok(visualCss.includes('min-height:44px'));
assert.ok(visualCss.includes('@media(max-width:760px)'));
assert.match(html, /<title>[^<]+<\/title>/);
assert.match(html, /application\/ld\+json/);
assert.match(html, /Saltar al contenido/);
assert.match(html, /CARTELERA DE CINE EN PARAGUAY/);
assert.match(html, /type="application\/rss\+xml"/);
assert.match(html, /fetchpriority="high"/);
assert.doesNotMatch(html, /fonts\.googleapis\.com|unpkg\.com/i);
const buildInfo = JSON.parse(await fs.readFile(path.join(dist, 'build-info.json'), 'utf8'));
assert.ok(Number.isInteger(buildInfo.movieCount) && buildInfo.movieCount > 0, 'build must include movies from the selected feed');
assert.ok(buildInfo.cinemaCount > 0 && buildInfo.routeCount >= buildInfo.movieCount + 5);
assert.equal(buildInfo.routeCount, buildInfo.movieCount + buildInfo.cinemaCount + 5);
assert.ok(Number.isInteger(buildInfo.cinemaProfilesWithPrices) && buildInfo.cinemaProfilesWithPrices >= 0);
assert.ok(Number.isInteger(buildInfo.moviesWithOfficialDetails) && buildInfo.moviesWithOfficialDetails >= 0);
const movieDirectory = path.join(dist, 'pelicula');
const movieRoutes = await fs.readdir(movieDirectory);
assert.equal(movieRoutes.length, buildInfo.movieCount, 'one static page per generated movie');
for (const route of movieRoutes) {
  const detail = await fs.readFile(path.join(movieDirectory, route, 'index.html'), 'utf8');
  assert.match(detail, /<title>[^<]+<\/title>/, `missing title on ${route}`);
  assert.match(detail, /<meta name="description"/, `missing description on ${route}`);
  assert.match(detail, /<link rel="canonical"/, `missing canonical on ${route}`);
  assert.match(detail, /Horarios|funciones|salas/i, `missing session content on ${route}`);
  assert.match(detail, /application\/ld\+json/, `missing structured data on ${route}`);
  assert.doesNotMatch(detail, /href=["']https?:\/\/(?:www\.)?cines\.com\.py/i, 'external cinema redirect in ' + route);
  assert.doesNotMatch(detail, /propuesta independiente|no es un sitio oficial|no está afiliado/i, `parallel-site disclaimer in ${route}`);
  const venueNames = [...detail.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]);
  assert.equal(venueNames.length, new Set(venueNames).size, `duplicate venue group on ${route}`);
}
const sitemap = await fs.readFile(path.join(dist, 'sitemap.xml'), 'utf8');
const robots = await fs.readFile(path.join(dist, 'robots.txt'), 'utf8');
assert.ok(robots.includes('https://yosoymitxel.github.io/cines.com.py/sitemap.xml'));
assert.ok(!robots.includes('/cines.com.py/cines.com.py/'));
assert.ok(sitemap.includes('https://yosoymitxel.github.io/cines.com.py/'));
assert.ok(!sitemap.includes('/cines.com.py/cines.com.py/'));
assert.equal((sitemap.match(/<url>/g) || []).length, buildInfo.routeCount, 'sitemap and generated route count differ');
console.log(`PASS: ${buildInfo.routeCount} rutas HTML, ${buildInfo.movieCount} películas, ${buildInfo.cinemaCount} salas; ${buildInfo.cinemaProfilesWithPrices} fichas con tarifas y ${buildInfo.moviesWithOfficialDetails} con metadata oficial.`);

const upcomingFixture = await fs.readFile(path.join(root, 'tests/fixtures/estrenos-sample.html'), 'utf8');
const parsedUpcoming = extractUpcoming(upcomingFixture);
assert.equal(parsedUpcoming.length, 2, 'upcoming parser must pair headings and deduplicate titles');
assert.equal(parsedUpcoming[0].title, 'Hechizo: Bienvenidos a Hexe');
assert.equal(parsedUpcoming[0].date, '26 de Noviembre de 2026');
assert.match(parsedUpcoming[0].description, /poderes mágicos & secretos/);
assert.equal(parsedUpcoming[1].title, 'Noche sin paz 2');
const now = new Date('2026-11-21T15:00:00-03:00');
assert.equal(isFutureRelease(parsedUpcoming[1], now), true, 'a release without year should resolve to the next occurrence');
assert.equal(isFutureRelease({ date: '19 de noviembre de 2026' }, now), false, 'past releases with explicit year should be excluded');
assert.equal(isFutureRelease({ date: '3 de enero' }, new Date('2026-12-29T12:00:00-03:00')), true, 'yearless January release should roll into the next year');
console.log('PASS: parser de estrenos, asociación título/fecha/sinopsis, duplicados y fechas sin año.');

const cinemaIndexFixture = await fs.readFile(path.join(root, 'tests/fixtures/cines-index.html'), 'utf8');
const cinemaLinks = extractCinemaLinks(cinemaIndexFixture);
assert.equal(cinemaLinks.length, 2, 'only official cinema links should be accepted');
assert.equal(cinemaLinks[0].name, 'Cines Itaú Pinedo');
assert.equal(new URL(cinemaLinks[0].url).hostname, 'www.cines.com.py');
const cinemaPageFixture = await fs.readFile(path.join(root, 'tests/fixtures/cine-pinedo.html'), 'utf8');
const cinemaData = extractCinemaPageData(cinemaPageFixture, [
  { id: 3525, title: 'Los juegos del hambre: Amanecer en la cosecha' },
  { id: 3557, title: 'Yo soy Rocky' }
]);
assert.deepEqual(cinemaData.tariffs.map(item => item.format), ['2D', '3D', '4D']);
assert.match(cinemaData.tariffs[0].lines.join(' '), /25\.000GS/);
assert.equal(cinemaData.filmDetails[3525].director, 'Francis Lawrence.');
assert.match(cinemaData.filmDetails[3525].cast, /Joseph Zada.*Elle Fanning/);
assert.equal(cinemaData.filmDetails[3525].runtime, '150 min.');
assert.equal(cinemaData.filmDetails[3557].director, 'Peter Farrelly.');
console.log('PASS: extracción de fichas oficiales, tarifas 2D/3D/4D y metadatos de películas.');

const catalogue = await fs.readFile(path.join(dist, 'cartelera/index.html'), 'utf8');
assert.match(catalogue, /id="results-count"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(catalogue, /id="no-results"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(visualCss, /\.film-index[^}]*color:#b93220/);
const buildSource = await fs.readFile(path.join(root, 'scripts/build.mjs'), 'utf8');
assert.match(buildSource, /aria-label="Afiche no disponible: \$\{escapeHtml\(movie\.title\)\}"/);
