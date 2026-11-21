import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractUpcoming, isFutureRelease } from './upcoming.mjs';
import { extractCinemaLinks, extractCinemaPageData, normaliseOfficialName } from './official.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA_FILE = path.join(ROOT, 'data', 'cines.json');
const DATA_URL = process.env.CINES_DATA_URL || 'https://raw.githubusercontent.com/yosoymitxel/Web-scrapping/main/data/cines.json';
const UPCOMING_URL = process.env.UPCOMING_DATA_URL || 'https://www.cines.com.py/estrenos/';
const BASE_PATH = normaliseBase(process.env.BASE_PATH || '/cines.com.py/');
const SITE_URL = new URL(process.env.SITE_URL || 'https://yosoymitxel.github.io').origin;
const OFFICIAL_HOSTS = new Set(['cines.com.py', 'www.cines.com.py']);

function normaliseBase(value) {
  const trimmed = `/${String(value).replace(/^\/+|\/+$/g, '')}/`;
  return trimmed === '//'? '/' : trimmed;
}

const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
const slugify = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-titulo';
const safeUrl = (value, allowedHosts) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    if (allowedHosts && !allowedHosts.has(url.hostname.toLowerCase())) return '';
    return url.href;
  } catch { return ''; }
};
const local = value => `${BASE_PATH}${String(value).replace(/^\/+/, '')}`;
const canonical = route => {
  if (route === '/') return `${SITE_URL}${BASE_PATH}`;
  const clean = route.replace(/^\/+|\/+$/g, '');
  return `${SITE_URL}${BASE_PATH}${clean}${/\.[a-z0-9]+$/i.test(clean) ? '' : '/'}`;
};
const formatTimestamp = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Asuncion' }).format(date);
};
const unique = list => [...new Set(list)];

async function loadCurrentData() {
  try {
    if (process.env.OFFLINE === '1') throw new Error('modo offline solicitado');
    const response = await fetch(DATA_URL, { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'cines-py-static-proposal/1.0' } });
    if (!response.ok) throw new Error(`feed HTTP ${response.status}`);
    const fresh = await response.json();
    validateData(fresh);
    console.log(`Feed actualizado: ${fresh.movies.length} películas (${DATA_URL})`);
    return fresh;
  } catch (error) {
    console.warn(`No se pudo recuperar el feed (${error.message}); se utiliza el snapshot local.`);
    const snapshot = await readJson(DATA_FILE);
    validateData(snapshot);
    return snapshot;
  }
}

function validateData(data) {
  if (!data || !Array.isArray(data.movies)) throw new Error('El JSON debe contener movies[].');
  if (data.movies.length === 0) throw new Error('No hay películas para publicar; se evita generar una cartelera vacía.');
  for (const movie of data.movies) {
    if (movie.id == null || !String(movie.title || '').trim()) throw new Error('Película sin id o título.');
    if (!Array.isArray(movie.at)) movie.at = [];
    if (!Array.isArray(movie.genres)) movie.genres = [];
  }
}

function normaliseMovies(data) {
  const seen = new Map();
  return data.movies.map((movie, index) => {
    const baseSlug = slugify(movie.title);
    const slug = seen.has(baseSlug) ? `${baseSlug}-${movie.id}` : baseSlug;
    seen.set(baseSlug, true);
    const venues = new Map();
    for (const venue of movie.at || []) {
      const name = String(venue.cine || '').trim();
      if (!name) continue;
      const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const existing = venues.get(key) || { name, times: [] };
      existing.times.push(...(Array.isArray(venue.times) ? venue.times.map(String) : []));
      existing.times = unique(existing.times);
      venues.set(key, existing);
    }
    const genres = unique((movie.genres || []).map(x => String(x).trim()).filter(Boolean));
    return {
      ...movie,
      slug,
      title: String(movie.title).trim(),
      img: safeUrl(movie.img),
      url: safeUrl(movie.url, OFFICIAL_HOSTS),
      genres,
      venues: [...venues.values()],
      index
    };
  });
}

function pageShell({ title, description, route, content, active = '', image = '', type = 'website', jsonLd = null }) {
  const metaImage = safeUrl(image) || `${SITE_URL}${BASE_PATH}assets/share.svg`;
  const canonicalUrl = canonical(route);
  const nav = [
    ['Cartelera', 'cartelera/', 'cartelera'],
    ['Estrenos', 'estrenos/', 'estrenos'],
    ['Salas', 'salas/', 'salas'],
    ['Cómo funciona', 'contacto/', 'contacto']
  ];
  const navHtml = nav.map(([label, href, key]) => `<a class="nav-link${active === key ? ' is-active' : ''}" href="${local(href)}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="es-PY">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5efe5">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="author" content="Cines PY">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="Cines PY · Cartelera" href="${local('feed.xml')}">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:locale" content="es_PY">
  <meta property="og:site_name" content="Cines PY · Cartelera">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(metaImage)}">
  <meta property="og:image:alt" content="Cartelera de cine en Paraguay: ${escapeHtml(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(metaImage)}">
  <link rel="icon" href="${local('assets/favicon.svg')}" type="image/svg+xml">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" referrerpolicy="no-referrer">
  <link rel="stylesheet" href="${local('assets/main.css')}">
  <link rel="stylesheet" href="${local('assets/redesign.css')}">
  ${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ''}
  <script src="${local('assets/main.js')}" defer></script>
</head>
<body>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${local('')}" aria-label="Cines PY, inicio"><i class="fa-solid fa-film brand-icon" aria-hidden="true"></i><span class="brand-type">CINES<span>.PY</span></span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation"><span></span><span></span><span class="sr-only">Abrir menú</span></button>
      <nav class="main-navigation" id="main-navigation" aria-label="Navegación principal">${navHtml}</nav>
    </div>
  </header>
  ${content}
  <footer class="site-footer">
    <div class="footer-top"><a class="brand brand-footer" href="${local('')}"><i class="fa-solid fa-film brand-icon" aria-hidden="true"></i><span class="brand-type">CINES<span>.PY</span></span></a><p>Una guía de cartelera para encontrar tu próxima función.</p></div>
    <div class="footer-bottom"><span>© CINES.PY · CARTELERA DE CINE EN PARAGUAY</span><span>Datos de cartelera: ${escapeHtml(formatTimestamp(DATA_UPDATED))}</span></div>
  </footer>
</body>
</html>`;
}

let DATA_UPDATED = '';

function poster(movie, className = '', loading = 'lazy') {
  if (!movie.img) return `<div class="poster-fallback ${className}" role="img" aria-label="Afiche no disponible"><span>${escapeHtml(movie.title)}</span></div>`;
  const priority = loading === 'eager' ? 'high' : 'auto';
  return `<img class="poster-image ${className}" src="${escapeHtml(movie.img)}" alt="Afiche de ${escapeHtml(movie.title)}" loading="${loading}" fetchpriority="${priority}" decoding="async" width="420" height="620">`;
}

function movieCard(movie, index = 0) {
  const link = local(`pelicula/${movie.slug}/`);
  const genres = movie.genres.slice(0, 2).map(escapeHtml).join(' · ');
  const cinemaCount = movie.venues.length;
  return `<article class="film-card" data-film-card data-search="${escapeHtml(`${movie.title} ${movie.genres.join(' ')}`.toLowerCase())}" data-genre="${escapeHtml(movie.genres.join('|'))}">
    <a class="film-poster-link" href="${link}" aria-label="Ver horarios de ${escapeHtml(movie.title)}">${poster(movie)}<span class="poster-open">Ver película <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></span></a>
    <div class="film-copy"><div class="film-index">${String(index + 1).padStart(2, '0')} <span>${cinemaCount} ${cinemaCount === 1 ? 'sala' : 'salas'}</span></div><h3><a href="${link}">${escapeHtml(movie.title)}</a></h3><p class="film-genres">${genres || 'Género no informado'}</p><a class="text-link" href="${link}">Horarios y salas <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></a></div>
  </article>`;
}

function timeBlock(venue) {
  return `<div class="session-copy">${venue.times.map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>`;
}

function programmeLine(movie, showtimes) {
  return `<article class="programme-line"><a class="mini-poster" href="${local(`pelicula/${movie.slug}/`)}">${poster(movie)}</a><div class="programme-main"><h3><a href="${local(`pelicula/${movie.slug}/`)}">${escapeHtml(movie.title)}</a></h3><p>${escapeHtml(movie.genres.join(' · ') || 'Género no informado')}</p><div class="programme-times">${showtimes}</div></div><a class="line-arrow" href="${local(`pelicula/${movie.slug}/`)}" aria-label="Ver ${escapeHtml(movie.title)}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></article>`;
}

function pageHome(movies, venues, updatedAt) {
  const lead = movies[0];
  const featured = movies.slice(1, 5).map((m, i) => programmeLine(m, `${m.venues.length} ${m.venues.length === 1 ? 'sala' : 'salas'}`)).join('');
  const cards = movies.slice(1, 9).map(movieCard).join('');
  const jsonLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Cines PY · Cartelera', url: canonical('/'), inLanguage: 'es-PY', description: 'Cartelera de cine en Paraguay: películas, salas y horarios.' };
  const content = `<main id="contenido">
    <section class="front-matter"><div class="front-inner"><div class="front-kicker"><span class="live-mark"></span> CARTELERA DE PARAGUAY <span class="front-date">Actualizada ${escapeHtml(formatTimestamp(updatedAt))}</span></div><div class="front-layout">
      <div class="front-lead"><div class="front-lead-copy"><p class="section-index">EN CARTELERA <span>／</span> DESTACADA</p><h1>${escapeHtml(lead.title)}</h1><p class="lead-genres">${escapeHtml(lead.genres.join(' · ') || 'Género no informado')}</p><p class="lead-summary">Consultá los horarios y las salas donde se proyecta. Elegí una función y encontrá tu próxima película.</p><a class="button-primary" href="${local(`pelicula/${lead.slug}/`)}">Ver horarios <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></a></div><a class="lead-poster" href="${local(`pelicula/${lead.slug}/`)}" aria-label="Ver funciones de ${escapeHtml(lead.title)}">${poster(lead, '', 'eager')}<span class="poster-stamp">EN SALA<br>AHORA</span></a></div>
      <aside class="front-side"><div class="side-heading"><span>OTRAS PELÍCULAS</span><span>0${Math.min(4, movies.length - 1)}</span></div>${featured || '<p class="empty-note">No hay más títulos en la cartelera.</p>'}<a class="all-link" href="${local('cartelera/')}">Ver cartelera completa <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></a></aside>
    </div><div class="front-bottom"><span><strong>${movies.length}</strong> películas publicadas</span><span><strong>${venues.length}</strong> salas listadas</span><span>Paraguay <b>·</b> Guaraní</span></div></div></section>
    <section class="section-shell film-section"><div class="section-heading"><div><p class="section-index">EL PROGRAMA</p><h2>En cartelera</h2><p>Películas y funciones disponibles en las salas del país.</p></div><a class="text-link" href="${local('cartelera/')}">Toda la cartelera <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></a></div><div class="film-grid">${cards}</div></section>
    <section class="venue-band"><div class="venue-band-inner"><div><p class="section-index">DÓNDE VERLAS</p><h2>La sala también<br>es parte de la película.</h2><p>Explorá la programación por cine y encontrá una función cerca de tu zona.</p><a class="button-light" href="${local('salas/')}">Explorar las ${venues.length} salas <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></a></div><div class="venue-list-preview">${venues.slice(0, 6).map((v, i) => `<a href="${local(`cine/${v.slug}/`)}"><span>${String(i + 1).padStart(2, '0')}</span>${escapeHtml(v.name)}<b><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></b></a>`).join('')}</div></div></section>
    
  </main>`;
  return pageShell({ title: 'Cartelera de cine en Paraguay | Cines PY', description: `Consultá ${movies.length} películas en cartelera, sus horarios y las ${venues.length} salas disponibles en Paraguay.`, route: '/', content, jsonLd });
}

function pageCatalogue(movies, updatedAt) {
  const genres = unique(movies.flatMap(m => m.genres)).sort((a, b) => a.localeCompare(b, 'es'));
  const filter = `<div class="catalogue-tools"><label class="search-field"><span class="sr-only">Buscar película o género</span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" id="film-search" placeholder="Buscar película o género" autocomplete="off"></label><div class="genre-filters" aria-label="Filtrar por género"><button class="filter-chip is-selected" type="button" data-genre-filter="all" aria-pressed="true">Todos</button>${genres.map(g => `<button class="filter-chip" type="button" data-genre-filter="${escapeHtml(g)}" aria-pressed="false">${escapeHtml(g)}</button>`).join('')}</div><p id="results-count" class="results-count" aria-live="polite">${movies.length} películas</p></div>`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Películas en cartelera en Paraguay', numberOfItems: movies.length, itemListElement: movies.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: canonical(`/pelicula/${m.slug}/`), name: m.title })) };
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">PROGRAMACIÓN ACTUAL <span>／</span> ${escapeHtml(formatTimestamp(updatedAt))}</p><h1>Cartelera</h1><p>Buscá una película y compará en qué salas aparece publicada.</p></div><div class="intro-count"><strong>${movies.length.toString().padStart(2,'0')}</strong><span>películas<br>en cartelera</span></div></div></section><section class="section-shell catalogue-section">${filter}<div class="film-grid" id="film-grid">${movies.map(movieCard).join('')}</div><p class="no-results" id="no-results" hidden>No encontramos películas con esos filtros. Probá con otro título o género.</p></section></main>`;
  return pageShell({ title: 'Cartelera de cine: películas y horarios en Paraguay | Cines PY', description: 'Buscá películas en cartelera y consultá las salas y horarios publicados en Paraguay.', route: '/cartelera/', content, active: 'cartelera', jsonLd });
}

function pageMovie(movie) {
  const sessions = movie.venues.length ? movie.venues.map((venue, i) => `<article class="venue-session"><div class="session-number">${String(i + 1).padStart(2,'0')}</div><div class="session-venue"><h2>${escapeHtml(venue.name)}</h2>${timeBlock(venue)}</div><span class="session-arrow" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span></article>`).join('') : '<p class="empty-note">Esta película no tiene salas informadas en el último archivo de cartelera.</p>';
  const meta = movie.genres.length ? movie.genres.map(g => `<span>${escapeHtml(g)}</span>`).join('') : '<span>Género no informado</span>';
  const factLabels = [['Dirección', movie.officialDetails?.director], ['Reparto', movie.officialDetails?.cast], ['Origen', movie.officialDetails?.origin], ['Duración', movie.officialDetails?.runtime], ['Clasificación', movie.officialDetails?.rating], ['Distribuidora', movie.officialDetails?.distributor]];
  const officialFacts = factLabels.filter(([, value]) => value).map(([label, value]) => `<div class="movie-meta-row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const officialFactsBlock = officialFacts ? `<section class="official-movie-facts"><h2>Ficha de la película</h2><dl>${officialFacts}</dl><p>Detalles disponibles de la película.</p></section>` : '';
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Movie', name: movie.title, image: movie.img || undefined, genre: movie.genres.length ? movie.genres : undefined, url: canonical(`/pelicula/${movie.slug}/`),  };
  const content = `<main id="contenido" class="page-main"><div class="breadcrumb section-shell"><a href="${local('')}">Inicio</a><span>/</span><a href="${local('cartelera/')}">Cartelera</a><span>/</span><span>${escapeHtml(movie.title)}</span></div><section class="movie-detail section-shell"><div class="movie-poster-large">${poster(movie, 'poster-detail', 'eager')}</div><div class="movie-detail-copy"><p class="section-index">PELÍCULA <span>／</span> CARTELERA ACTUAL</p><h1>${escapeHtml(movie.title)}</h1><div class="movie-genres">${meta}</div><p class="movie-note">Consultá las funciones publicadas por cada sala. Los horarios están organizados por sala para facilitar la comparación.</p><div class="movie-facts"><div><strong>${movie.venues.length.toString().padStart(2,'0')}</strong><span>${movie.venues.length === 1 ? 'sala informada' : 'salas informadas'}</span></div><div><strong>${movie.genres.length.toString().padStart(2,'0')}</strong><span>${movie.genres.length === 1 ? 'género' : 'géneros'}</span></div></div>${officialFactsBlock}</div></section><section class="session-section section-shell"><div class="section-heading"><div><p class="section-index">FUNCIONES PUBLICADAS</p><h2>Salas y horarios</h2><p>${escapeHtml(movie.title)} · ${movie.venues.length} ${movie.venues.length === 1 ? 'sala' : 'salas'}</p></div></div><div class="session-list">${sessions}</div></section><section class="back-to-catalogue section-shell"><a href="${local('cartelera/')}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Volver a la cartelera</a></section></main>`;
  return pageShell({ title: `${movie.title}: horarios y salas en Paraguay | Cines PY`, description: `Consultá las salas y horarios publicados para ${movie.title} en Paraguay.`, route: `/pelicula/${movie.slug}/`, content, image: movie.img, type: 'article', jsonLd });
}

function pageVenue(venue, films) {
  const activeMovies = films.filter(m => m.venues.some(v => v.slug === venue.slug));
  const listings = activeMovies.map(movie => {
    const showtimes = movie.venues.find(v => v.slug === venue.slug);
    return programmeLine(movie, showtimes.times.map(t => `<span>${escapeHtml(t)}</span>`).join(''));
  }).join('');
  const tariffs = venue.tariffs?.length ? `<section class="venue-tariffs"><div class="section-heading"><div><p class="section-index">INFORMACIÓN DE SALAS</p><h2>Tarifas publicadas</h2></div></div><div class="tariff-grid">${venue.tariffs.map(item => `<article class="tariff-block"><h3>${escapeHtml(item.format)}</h3>${item.lines.map(line => `<p>${escapeHtml(line)}</p>`).join('')}</article>`).join('')}</div></section>` : '';
  const content = `<main id="contenido" class="page-main"><div class="breadcrumb section-shell"><a href="${local('')}">Inicio</a><span>/</span><a href="${local('salas/')}">Salas</a><span>/</span><span>${escapeHtml(venue.name)}</span></div><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">SALA <span>／</span> PROGRAMACIÓN DISPONIBLE</p><h1>${escapeHtml(venue.name)}</h1><p>Películas y horarios que aparecen publicados para esta sala.</p></div><div class="intro-count"><strong>${activeMovies.length.toString().padStart(2,'0')}</strong><span>películas<br>en cartelera</span></div></div></section><section class="section-shell venue-detail-section"><div class="section-heading"><div><p class="section-index">PROGRAMACIÓN</p><h2>Funciones</h2></div></div><div class="programme-list">${listings || '<p class="empty-note">No hay funciones cargadas para esta sala.</p>'}</div>${tariffs}</section></main>`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'MovieTheater', name: venue.name, url: canonical(`/cine/${venue.slug}/`),  };
  return pageShell({ title: `${venue.name}: películas y horarios | Cines PY`, description: `Películas y horarios publicados para ${venue.name}.`, route: `/cine/${venue.slug}/`, content, jsonLd });
}

function pageVenues(venues) {
  const groups = new Map();
  for (const venue of venues) {
    const first = venue.name.split(' - ').at(-1);
    const group = /^(CDE|Encarnación|Caaguazu|Pilar|PJC|Lambaré|San Lorenzo|Itauguá|Cnel Oviedo)$/i.test(first) ? first : 'Otras ubicaciones';
    groups.set(group, [...(groups.get(group) || []), venue]);
  }
  const listing = [...groups.entries()].map(([group, list]) => `<section class="venue-group"><div class="venue-group-title"><h2>${escapeHtml(group)}</h2><span>${list.length.toString().padStart(2,'0')} ${list.length === 1 ? 'sala' : 'salas'}</span></div>${list.map((v,i) => `<a class="venue-row" href="${local(`cine/${v.slug}/`)}"><span class="venue-row-index">${String(venues.indexOf(v)+1).padStart(2,'0')}</span><strong>${escapeHtml(v.name)}</strong><span>${v.films.length} ${v.films.length === 1 ? 'película' : 'películas'}</span><b><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></b></a>`).join('')}</section>`).join('');
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">DIRECTORIO <span>／</span> PARAGUAY</p><h1>Salas de cine</h1><p>Encontrá las salas incluidas en la cartelera y revisá qué películas tienen publicadas.</p></div><div class="intro-count"><strong>${venues.length.toString().padStart(2,'0')}</strong><span>salas<br>en el listado</span></div></div></section><section class="section-shell venue-directory">${listing}</section></main>`;
  return pageShell({ title: 'Salas de cine en Paraguay: cartelera y horarios | Cines PY', description: `Directorio de ${venues.length} salas de cine con películas y funciones publicadas en Paraguay.`, route: '/salas/', content, active: 'salas' });
}

function pageUpcoming(items) {
  const body = items.length ? `<div class="upcoming-list">${items.map((item, i) => `<article class="upcoming-row"><span class="upcoming-index">${String(i+1).padStart(2,'0')}</span><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.date || 'Fecha por confirmar')}</p>${item.description ? `<div class="upcoming-description">${escapeHtml(item.description)}</div>` : ''}</div></article>`).join('')}</div>` : `<div class="empty-state"><span class="empty-mark">+</span><h2>Los próximos estrenos todavía no están disponibles en el feed.</h2><p>Cuando haya fechas confirmadas, aparecerán en esta sección.</p></div>`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Próximos estrenos de cine en Paraguay', numberOfItems: items.length, itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title })) };
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">CALENDARIO <span>／</span> PRÓXIMOS ESTRENOS</p><h1>Lo que viene</h1><p>Fechas previstas para los próximos estrenos.</p></div><div class="intro-count"><strong>${items.length.toString().padStart(2,'0')}</strong><span>estrenos<br>registrados</span></div></div></section><section class="section-shell upcoming-section">${body}</section></main>`;
  return pageShell({ title: 'Próximos estrenos de cine en Paraguay | Cines PY', description: 'Calendario de próximos estrenos de cine en Paraguay.', route: '/estrenos/', content, active: 'estrenos', jsonLd });
}

function pageContact() {
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">CINES.PY <span>／</span> INFORMACIÓN</p><h1>Cómo usar la cartelera</h1><p>Todo lo que necesitás para elegir tu próxima función.</p></div></div></section><section class="section-shell contact-section"><h2>Encontrá tu próxima película</h2><p>Explorá la cartelera, compará las salas y revisá los horarios disponibles en cada ficha.</p><div class="info-steps"><article><i class="fa-solid fa-film" aria-hidden="true"></i><h3>Elegí una película</h3><p>Buscá por título o género y abrí su ficha.</p></article><article><i class="fa-solid fa-location-dot" aria-hidden="true"></i><h3>Compará las salas</h3><p>Revisá en qué cines aparece programada.</p></article><article><i class="fa-regular fa-clock" aria-hidden="true"></i><h3>Revisá los horarios</h3><p>Consultá los horarios organizados por sala.</p></article></div><a class="button-primary" href="${local('cartelera/')}">Explorar cartelera <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></section></main>`;
  return pageShell({ title: 'Cómo usar la cartelera | Cines PY', description: 'Guía para buscar películas, comparar salas y consultar horarios en Paraguay.', route: '/contacto/', content, active: 'contacto' });
}


async function loadOfficialIndex() {
  try {
    if (process.env.OFFLINE === '1') throw new Error('modo offline solicitado');
    const response = await fetch(UPCOMING_URL, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'cines-py-static-proposal/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.warn(`No se pudo actualizar el calendario: ${error.message}`);
    return '';
  }
}

async function loadUpcoming(indexHtml) {
  const localData = await readJson(path.join(ROOT, 'data', 'estrenos.json')).catch(() => []);
  const parsed = indexHtml ? extractUpcoming(indexHtml).filter(isFutureRelease) : [];
  if (parsed.length) {
    console.log(`Estrenos incorporados: ${parsed.length}`);
    return parsed;
  }
  console.warn('Se utiliza el snapshot local de próximos estrenos.');
  return Array.isArray(localData) ? localData.filter(isFutureRelease) : [];
}

async function enrichOfficialCinemaData(indexHtml, venues, movies) {
  if (!indexHtml) return;
  const links = extractCinemaLinks(indexHtml, UPCOMING_URL);
  const matched = venues.map(venue => {
    const key = normaliseOfficialName(venue.name);
    const link = links.find(item => item.key === key)
      || links.find(item => item.key.includes(key) || key.includes(item.key));
    if (link) venue.officialUrl = link.url;
    return { venue, link };
  }).filter(item => item.link);
  if (!matched.length) {
    console.warn('No se encontraron fichas de salas para actualizar.');
    return;
  }
  let loaded = 0;
  for (let offset = 0; offset < matched.length; offset += 4) {
    await Promise.all(matched.slice(offset, offset + 4).map(async ({ venue, link }) => {
      try {
        const response = await fetch(link.url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'cines-py-static-proposal/1.0' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const details = extractCinemaPageData(await response.text(), movies);
        venue.tariffs = details.tariffs;
        for (const movie of movies) {
          const facts = details.filmDetails[movie.id];
          if (!facts) continue;
          movie.officialDetails ||= {};
          for (const [key, value] of Object.entries(facts)) {
            if (!movie.officialDetails[key]) movie.officialDetails[key] = value;
          }
          if (!movie.genres.length && facts.genres) {
            movie.genres = facts.genres.split(/\s*,\s*/).map(value => value.trim()).filter(Boolean);
          }
        }
        loaded += 1;
      } catch (error) {
        console.warn(`No se pudo actualizar ${venue.name}: ${error.message}`);
      }
    }));
  }
  const priceLists = venues.filter(venue => venue.tariffs?.length).length;
  const metadata = movies.filter(movie => Object.keys(movie.officialDetails || {}).length).length;
  console.log(`Fichas de salas actualizadas: ${loaded}/${matched.length}; ${priceLists} tarifas; ${metadata} fichas de películas enriquecidas.`);
}

function xmlEscape(value) { return escapeHtml(value).replace(/&#39;/g, '&apos;'); }

async function writePage(route, html) {
  const directory = path.join(DIST, route.replace(/^\/+|\/+$/g, ''));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html);
}

async function build() {
  const data = await loadCurrentData();
  validateData(data);
  DATA_UPDATED = data.at || new Date().toISOString();
  const movies = normaliseMovies(data);
  const venueMap = new Map();
  for (const movie of movies) {
    for (const item of movie.venues) {
      const key = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const existing = venueMap.get(key) || { name: item.name, slug: slugify(item.name), films: [] };
      existing.films.push(movie);
      venueMap.set(key, existing);
      item.slug = existing.slug;
    }
  }
  const venues = [...venueMap.values()].sort((a,b) => a.name.localeCompare(b.name, 'es'));
  const usedVenueSlugs = new Set();
  for (const venue of venues) {
    const baseSlug = slugify(venue.name);
    let slug = baseSlug;
    let suffix = 2;
    while (usedVenueSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    venue.slug = slug;
    usedVenueSlugs.add(slug);
    for (const movie of venue.films) {
      const record = movie.venues.find(item => item.name === venue.name);
      if (record) record.slug = slug;
    }
  }
  const officialIndex = await loadOfficialIndex();
  await enrichOfficialCinemaData(officialIndex, venues, movies);
  const upcoming = await loadUpcoming(officialIndex);
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  await writePage('/', pageHome(movies, venues, DATA_UPDATED));
  await writePage('/cartelera/', pageCatalogue(movies, DATA_UPDATED));
  await writePage('/estrenos/', pageUpcoming(upcoming));
  await writePage('/salas/', pageVenues(venues));
  await writePage('/contacto/', pageContact());
  for (const movie of movies) await writePage(`/pelicula/${movie.slug}/`, pageMovie(movie));
  for (const venue of venues) await writePage(`/cine/${venue.slug}/`, pageVenue(venue, movies));
  await fs.mkdir(path.join(DIST, 'assets'), { recursive: true });
  for (const file of ['main.css', 'redesign.css', 'main.js', 'favicon.svg', 'share.svg']) await fs.copyFile(path.join(ROOT, 'assets', file), path.join(DIST, 'assets', file));
  const allRoutes = ['/', '/cartelera/', '/estrenos/', '/salas/', '/contacto/', ...movies.map(m => `/pelicula/${m.slug}/`), ...venues.map(v => `/cine/${v.slug}/`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allRoutes.map(route => `<url><loc>${xmlEscape(canonical(route))}</loc><lastmod>${new Date(DATA_UPDATED).toISOString().slice(0,10)}</lastmod></url>`).join('')}</urlset>`;
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}${BASE_PATH}sitemap.xml\n`);
  const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Cines PY · Cartelera</title><link>${xmlEscape(canonical('/'))}</link><description>Películas en cartelera en Paraguay</description>${movies.map(m => `<item><title>${xmlEscape(m.title)}</title><link>${xmlEscape(canonical(`/pelicula/${m.slug}/`))}</link><guid>${xmlEscape(canonical(`/pelicula/${m.slug}/`))}</guid><description>${xmlEscape(m.genres.join(' · '))}</description></item>`).join('')}</channel></rss>`;
  await fs.writeFile(path.join(DIST, 'feed.xml'), feed);
  await fs.writeFile(path.join(DIST, '404.html'), pageShell({ title: 'Página no encontrada | Cines PY', description: 'La dirección solicitada no existe.', route: '/404.html', content: `<main id="contenido" class="page-main"><section class="empty-state"><span class="empty-mark">404</span><h1>Esta función no está en cartelera.</h1><p>La dirección que buscás no existe o cambió.</p><a class="button-primary" href="${local('')}">Volver al inicio <span aria-hidden="true"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></a></section></main>` }));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  await fs.writeFile(path.join(DIST, 'build-info.json'), JSON.stringify({ updatedAt: DATA_UPDATED, movieCount: movies.length, cinemaCount: venues.length, routeCount: allRoutes.length, upcomingCount: upcoming.length, cinemaProfilesWithPrices: venues.filter(venue => venue.tariffs?.length).length, moviesWithOfficialDetails: movies.filter(movie => Object.keys(movie.officialDetails || {}).length).length }, null, 2));
  console.log(`Build listo: ${movies.length} películas, ${venues.length} salas, ${allRoutes.length} rutas, ${upcoming.length} estrenos.`);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
