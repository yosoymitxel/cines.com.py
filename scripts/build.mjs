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
    ['Principal', '', 'principal'],
    ['Cartelera y Horarios', 'cartelera/', 'cartelera'],
    ['Próximos Estrenos', 'estrenos/', 'estrenos'],
    ['Salas de Cine', 'salas/', 'salas'],
    ['Contáctenos', 'contacto/', 'contacto']
  ];
  const navHtml = nav.map(([label, href, key]) => `<a class="nav-link${active === key ? ' is-active' : ''}" href="${local(href)}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="es-PY">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0c0f14">
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
      <a class="brand" href="${local('')}" aria-label="Cines.com.py, inicio">
        <img class="brand-logo" src="${local('assets/logo.jpg')}" alt="Cines.com.py" width="58" height="42">
        <span class="brand-type">CINES<span>.COM.PY</span></span>
      </a>
      <div class="header-right">
        <nav class="main-navigation" id="main-navigation" aria-label="Navegación principal">${navHtml}</nav>
        <div class="header-social">
          <a class="header-social-link" href="https://www.facebook.com/CinesdelSol/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i class="fa-brands fa-facebook" aria-hidden="true"></i></a>
          <a class="header-social-link" href="https://twitter.com/CinesPY" target="_blank" rel="noopener noreferrer" aria-label="X / Twitter"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i></a>
          <a class="header-social-link" href="${local('feed.xml')}" aria-label="RSS"><i class="fa-solid fa-rss" aria-hidden="true"></i></a>
        </div>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation"><span></span><span></span><span class="sr-only">Abrir menú</span></button>
      </div>
    </div>
  </header>
  ${content}
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand-wrap">
        <a class="brand brand-footer" href="${local('')}">
          <img class="brand-logo" src="${local('assets/logo.jpg')}" alt="Cines.com.py" width="58" height="42">
          <span class="brand-type">CINES<span>.COM.PY</span></span>
        </a>
        <p>Guía de cartelera y horarios de cine en Paraguay.</p>
      </div>
      <nav class="footer-nav" aria-label="Navegación pie de página">
        <a href="${local('')}">Principal</a>
        <a href="${local('cartelera/')}">Cartelera y Horarios</a>
        <a href="${local('estrenos/')}">Próximos Estrenos</a>
        <a href="${local('salas/')}">Salas de Cine</a>
        <a href="${local('contacto/')}">Contáctenos</a>
      </nav>
      <div class="footer-social-wrap">
        <a class="social-btn" href="https://www.facebook.com/CinesdelSol/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i class="fa-brands fa-facebook" aria-hidden="true"></i> Facebook</a>
        <a class="social-btn" href="https://twitter.com/CinesPY" target="_blank" rel="noopener noreferrer" aria-label="X / Twitter"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i> X / Twitter</a>
        <a class="social-btn app-link" href="https://onelink.to/6weayk" target="_blank" rel="noopener noreferrer" aria-label="CinemaPop App"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> CinemaPop</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© CINES.COM.PY · CARTELERA DE CINE EN PARAGUAY</span>
      <span>MediaGroup · Fulgencio R. Moreno 176 · Asunción, Paraguay</span>
    </div>
  </footer>
</body>
</html>`;
}

let DATA_UPDATED = '';

const FILM_ICON_SVG = '<svg class="poster-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>';

function poster(movie, className = '', loading = 'lazy') {
  if (!movie.img) return `<div class="poster-fallback ${className}" role="img" aria-label="Afiche no disponible: ${escapeHtml(movie.title)}">${FILM_ICON_SVG}<span>${escapeHtml(movie.title)}</span></div>`;
  const priority = loading === 'eager' ? 'high' : 'auto';
  return `<img class="poster-image ${className}" src="${escapeHtml(movie.img)}" alt="Afiche de ${escapeHtml(movie.title)}" loading="${loading}" fetchpriority="${priority}" decoding="async" width="420" height="620">`;
}

function movieCard(movie, index = 0) {
  const link = local(`pelicula/${movie.slug}/`);
  const genres = movie.genres.slice(0, 2).map(escapeHtml).join(' · ');
  const cinemaCount = movie.venues.length;
  return `<article class="film-card" data-film-card data-search="${escapeHtml(`${movie.title} ${movie.genres.join(' ')}`.toLowerCase())}" data-genre="${escapeHtml(movie.genres.join('|'))}">
    <a class="film-poster-link" href="${link}" aria-label="Ver horarios de ${escapeHtml(movie.title)}">${poster(movie)}<span class="poster-open">Ver película <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span></a>
    <div class="film-copy"><div class="film-index">${String(index + 1).padStart(2, '0')} <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${cinemaCount} ${cinemaCount === 1 ? 'sala' : 'salas'}</span></div><h3><a href="${link}">${escapeHtml(movie.title)}</a></h3><p class="film-genres">${genres || 'Cartelera'}</p><a class="text-link" href="${link}">Horarios y salas <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></div>
  </article>`;
}

function timeBlock(venue) {
  return `<div class="session-copy">${venue.times.map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>`;
}

function programmeLine(movie, showtimes) {
  return `<article class="programme-line"><a class="mini-poster" href="${local(`pelicula/${movie.slug}/`)}" aria-label="${escapeHtml(movie.title)}">${poster(movie)}</a><div class="programme-main"><h3><a href="${local(`pelicula/${movie.slug}/`)}">${escapeHtml(movie.title)}</a></h3><p>${escapeHtml(movie.genres.join(' · ') || 'Cartelera')}</p><div class="programme-times">${showtimes}</div></div><a class="line-arrow" href="${local(`pelicula/${movie.slug}/`)}" aria-label="Ver ${escapeHtml(movie.title)}"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></article>`;
}

function pageHome(movies, venues, upcoming = []) {
  const lead = movies[0];
  const featured = movies.slice(1, 5).map((m, i) => programmeLine(m, `${m.venues.length} ${m.venues.length === 1 ? 'sala' : 'salas'}`)).join('');
  const cards = movies.slice(1, 9).map(movieCard).join('');
  const upcomingPreview = upcoming.slice(0, 4);
  const upcomingPreviewHtml = upcomingPreview.length ? `<section class="section-shell upcoming-preview-section"><div class="section-heading"><div><p class="section-index">CALENDARIO DE ESTRENOS</p><h2>Próximos estrenos</h2><p>Películas anunciadas que llegarán próximamente a los cines de Paraguay.</p></div><a class="text-link" href="${local('estrenos/')}">Ver todos los estrenos <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></div><div class="upcoming-preview-grid">${upcomingPreview.map((item, i) => `<article class="upcoming-preview-card"><div class="upcoming-preview-number">${String(i + 1).padStart(2, '0')}</div><div class="upcoming-preview-info"><h3>${escapeHtml(item.title)}</h3><p class="upcoming-preview-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${escapeHtml(item.date || 'Fecha a confirmar')}</p></div></article>`).join('')}</div></section>` : '';
  const jsonLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Cines PY · Cartelera', url: canonical('/'), inLanguage: 'es-PY', description: 'Cartelera de cine en Paraguay: películas, salas y horarios.' };
  const content = `<main id="contenido">
    <div class="banner-top-slot" role="region" aria-label="Espacio de aplicación oficial">
      <a class="sponsor-billboard" href="https://onelink.to/6weayk" target="_blank" rel="noopener noreferrer">
        <span class="sponsor-tag">APP OFICIAL</span>
        <span class="sponsor-text"><strong>CinemaPop Paraguay</strong> · Cartelera completa, salas y horarios en tu celular</span>
        <span class="sponsor-cta">Instalar <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
      </a>
    </div>
    <section class="front-matter"><div class="front-inner"><div class="front-kicker"><i class="fa-solid fa-film" aria-hidden="true"></i> CARTELERA DE CINE EN PARAGUAY</div><div class="front-layout">
      <div class="front-lead"><div class="front-lead-copy"><p class="section-index">EN CARTELERA <span>／</span> DESTACADA</p><h1>${escapeHtml(lead.title)}</h1><p class="lead-genres">${escapeHtml(lead.genres.join(' · ') || 'Cartelera nacional')}</p><p class="lead-summary">Consultá las salas y horarios de proyección en Paraguay para ${escapeHtml(lead.title)}. Funciones en Asunción, Gran Asunción y el interior.</p><a class="button-primary" href="${local(`pelicula/${lead.slug}/`)}">Ver horarios y salas <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></div><a class="lead-poster" href="${local(`pelicula/${lead.slug}/`)}" aria-label="Ver funciones de ${escapeHtml(lead.title)}">${poster(lead, '', 'eager')}<span class="poster-stamp">En cartelera</span></a></div>
      <aside class="front-side">
        <div class="side-heading"><span>EN CARTELERA</span><span>0${Math.min(4, movies.length - 1)}</span></div>
        ${featured || '<p class="empty-note">No hay más títulos en la cartelera.</p>'}
        <a class="all-link" href="${local('cartelera/')}">Ver cartelera completa <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a>
        <div class="side-ad-card">
          <a href="https://onelink.to/6weayk" target="_blank" rel="noopener noreferrer" class="app-promo-box">
            <div class="app-promo-icon"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i></div>
            <div class="app-promo-copy">
              <span class="app-tag">APP DESTACADA</span>
              <strong>CinemaPop</strong>
              <p>Horarios y salas en tu celular. Descargá para Android e iOS.</p>
            </div>
          </a>
        </div>
        <div class="side-social-card">
          <div class="social-card-header"><i class="fa-brands fa-facebook" aria-hidden="true"></i><span>Comunidad en Facebook</span></div>
          <p>Seguí las novedades de la cartelera, promociones y sorteos de entradas.</p>
          <a class="social-follow-btn" href="https://www.facebook.com/CinesdelSol/" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-facebook" aria-hidden="true"></i> Seguir en Facebook</a>
        </div>
      </aside>
    </div><div class="front-bottom"><span><strong>${movies.length}</strong> películas publicadas</span><span><strong>${venues.length}</strong> salas listadas</span><span>Paraguay <b>·</b> Cartelera de cine</span></div></div></section>
    <section class="section-shell film-section"><div class="section-heading"><div><p class="section-index">PROGRAMACIÓN</p><h2>En cartelera</h2><p>Películas y funciones disponibles hoy en cines del país.</p></div><a class="text-link" href="${local('cartelera/')}">Toda la cartelera <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></div><div class="film-grid">${cards}</div></section>
    <section class="venue-band"><div class="venue-band-inner"><div><p class="section-index">SALAS DE CINE</p><h2>Complejos y salas</h2><p>Explorá la programación por cine y encontrá funciones en tu complejo favorito.</p><a class="button-light" href="${local('salas/')}">Explorar las ${venues.length} salas <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></div><div class="venue-list-preview">${venues.slice(0, 6).map((v, i) => `<a href="${local(`cine/${v.slug}/`)}"><span>${String(i + 1).padStart(2, '0')}</span>${escapeHtml(v.name)}<b><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></b></a>`).join('')}</div></div></section>
    ${upcomingPreviewHtml}
  </main>`;
  return pageShell({ title: 'Cartelera de cine en Paraguay | Cines PY', description: `Consultá ${movies.length} películas en cartelera, sus horarios y las ${venues.length} salas disponibles en Paraguay.`, route: '/', content, active: 'principal', jsonLd });
}

function pageCatalogue(movies) {
  const genres = unique(movies.flatMap(m => m.genres)).sort((a, b) => a.localeCompare(b, 'es'));
  const filter = `<div class="catalogue-tools"><label class="search-field"><span class="sr-only">Buscar película o género</span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" id="film-search" placeholder="Buscar por título o género..." autocomplete="off"></label><div class="genre-filters" aria-label="Filtrar por género"><button class="filter-chip is-selected" type="button" data-genre-filter="all" aria-pressed="true">Todos</button>${genres.map(g => `<button class="filter-chip" type="button" data-genre-filter="${escapeHtml(g)}" aria-pressed="false">${escapeHtml(g)}</button>`).join('')}</div><p id="results-count" class="results-count" aria-live="polite" aria-atomic="true">${movies.length} películas</p></div>`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Películas en cartelera en Paraguay', numberOfItems: movies.length, itemListElement: movies.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: canonical(`/pelicula/${m.slug}/`), name: m.title })) };
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">PROGRAMACIÓN ACTUAL</p><h1>Cartelera y Horarios</h1><p>Buscá una película y consultá en qué salas y horarios se proyecta.</p></div><div class="intro-count"><strong>${movies.length.toString().padStart(2,'0')}</strong><span>películas<br>en cartelera</span></div></div></section><section class="section-shell catalogue-section">${filter}<div class="film-grid" id="film-grid">${movies.map(movieCard).join('')}</div><p class="no-results" id="no-results" role="status" aria-live="polite" aria-atomic="true" hidden>No encontramos películas con esos filtros. Probá con otro título o género.</p></section></main>`;
  return pageShell({ title: 'Cartelera de cine: películas y horarios en Paraguay | Cines PY', description: 'Buscá películas en cartelera y consultá las salas y horarios publicados en Paraguay.', route: '/cartelera/', content, active: 'cartelera', jsonLd });
}

function pageMovie(movie) {
  const sessions = movie.venues.length ? movie.venues.map((venue, i) => `<article class="venue-session"><div class="session-number">${String(i + 1).padStart(2,'0')}</div><div class="session-venue"><h2>${escapeHtml(venue.name)}</h2>${timeBlock(venue)}</div><a class="session-arrow" href="${local(`cine/${venue.slug}/`)}" aria-label="Ver funciones en ${escapeHtml(venue.name)}"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></article>`).join('') : '<p class="empty-note">Esta película no tiene salas informadas en el último archivo de cartelera.</p>';
  const meta = movie.genres.length ? movie.genres.map(g => `<span>${escapeHtml(g)}</span>`).join('') : '<span>Cartelera</span>';
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
    const group = /^(CDE|Encarnación|Caaguazu|Pilar|PJC|Lambaré|San Lorenzo|Itauguá|Cnel Oviedo)$/i.test(first) ? first : 'Asunción y Área Central';
    groups.set(group, [...(groups.get(group) || []), venue]);
  }
  const listing = [...groups.entries()].map(([group, list]) => `<section class="venue-group"><div class="venue-group-title"><h2>${escapeHtml(group)}</h2><span>${list.length.toString().padStart(2,'0')} ${list.length === 1 ? 'sala' : 'salas'}</span></div>${list.map((v,i) => `<a class="venue-row" href="${local(`cine/${v.slug}/`)}"><span class="venue-row-index">${String(venues.indexOf(v)+1).padStart(2,'0')}</span><strong>${escapeHtml(v.name)}</strong><span>${v.films.length} ${v.films.length === 1 ? 'película' : 'películas'}</span><b><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></b></a>`).join('')}</section>`).join('');
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">DIRECTORIO <span>／</span> PARAGUAY</p><h1>Salas de cine</h1><p>Encontrá las salas incluidas en la cartelera y revisá qué películas tienen publicadas.</p></div><div class="intro-count"><strong>${venues.length.toString().padStart(2,'0')}</strong><span>salas<br>en el listado</span></div></div></section><section class="section-shell venue-directory">${listing}</section></main>`;
  return pageShell({ title: 'Salas de cine en Paraguay: cartelera y horarios | Cines PY', description: `Directorio de ${venues.length} salas de cine con películas y funciones publicadas en Paraguay.`, route: '/salas/', content, active: 'salas' });
}

function pageUpcoming(items) {
  const body = items.length ? `<div class="upcoming-list">${items.map((item, i) => `<article class="upcoming-row"><span class="upcoming-index">${String(i+1).padStart(2,'0')}</span><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.date || 'Fecha por confirmar')}</p>${item.description ? `<div class="upcoming-description">${escapeHtml(item.description)}</div>` : ''}</div></article>`).join('')}</div>` : `<div class="empty-state"><span class="empty-mark">+</span><h2>Los próximos estrenos todavía no están disponibles en el feed.</h2><p>Cuando haya fechas confirmadas, aparecerán en esta sección.</p></div>`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Próximos estrenos de cine en Paraguay', numberOfItems: items.length, itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title })) };
  const content = `<main id="contenido" class="page-main"><section class="page-intro"><div class="page-intro-inner"><div><p class="section-index">CALENDARIO <span>／</span> PRÓXIMOS ESTRENOS</p><h1>Lo que viene</h1><p>Fechas previstas para los próximos estrenos en cines de Paraguay.</p></div><div class="intro-count"><strong>${items.length.toString().padStart(2,'0')}</strong><span>estrenos<br>registrados</span></div></div></section><section class="section-shell upcoming-section">${body}</section></main>`;
  return pageShell({ title: 'Próximos estrenos de cine en Paraguay | Cines PY', description: 'Calendario de próximos estrenos de cine en Paraguay.', route: '/estrenos/', content, active: 'estrenos', jsonLd });
}

function pageContact() {
  const content = `<main id="contenido" class="page-main">
    <section class="page-intro">
      <div class="page-intro-inner">
        <div>
          <p class="section-index">CINES.COM.PY <span>／</span> ATENCIÓN Y CONTACTO</p>
          <h1>Contáctenos</h1>
          <p>Si desea hacernos una consulta, sugerencia o comentario, complete el siguiente formulario.</p>
        </div>
      </div>
    </section>
    <section class="section-shell contact-section">
      <div class="info-steps">
        <article>
          <i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i>
          <h3>Consultas y sugerencias</h3>
          <p>Envianos tus preguntas o comentarios sobre la cartelera y el servicio.</p>
        </article>
        <article>
          <i class="fa-solid fa-bullhorn" aria-hidden="true"></i>
          <h3>Publicidad en Cines</h3>
          <p>Comunicate con MediaGroup (+595 21 419-8300) para pautas en salas.</p>
        </article>
        <article>
          <i class="fa-solid fa-clapperboard" aria-hidden="true"></i>
          <h3>Funciones Especiales</h3>
          <p>Coordiná funciones privadas o eventos escribiendo a funciones@cines.com.py.</p>
        </article>
      </div>
      <div class="contact-layout">
        <div class="contact-form-container">
          <h2>Envianos un mensaje</h2>
          <form class="contact-form" action="mailto:info@cines.com.py" method="post" enctype="text/plain">
            <div class="form-row">
              <div class="form-group">
                <label for="contacto_nombre">Nombre *</label>
                <input class="form-control" id="contacto_nombre" name="nombre" type="text" required placeholder="Tu nombre">
              </div>
              <div class="form-group">
                <label for="contacto_apellido">Apellido *</label>
                <input class="form-control" id="contacto_apellido" name="apellido" type="text" required placeholder="Tu apellido">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="contacto_email">Email *</label>
                <input class="form-control" id="contacto_email" name="email" type="email" required placeholder="tu@email.com">
              </div>
              <div class="form-group">
                <label for="contacto_celular">Celular</label>
                <input class="form-control" id="contacto_celular" name="celular" type="tel" placeholder="0981 000 000">
              </div>
            </div>
            <div class="form-group">
              <label for="contacto_mensaje">Consulta o mensaje *</label>
              <textarea class="form-control form-textarea" id="contacto_mensaje" name="mensaje" rows="5" required placeholder="Escribí tu consulta aquí..."></textarea>
            </div>
            <button class="button-primary form-submit-btn" type="submit">Enviar mensaje <i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
          </form>
        </div>
        <aside class="contact-sidebar">
          <div class="contact-card">
            <h3><i class="fa-solid fa-bullhorn" aria-hidden="true"></i> Publicidad en Cines</h3>
            <p><strong>MediaGroup</strong></p>
            <p>Tel.: +595 21 419-8300</p>
            <p><a href="mailto:info@mediagroup.com.py">info@mediagroup.com.py</a></p>
          </div>
          <div class="contact-card">
            <h3><i class="fa-solid fa-clapperboard" aria-hidden="true"></i> Funciones Especiales</h3>
            <p>Tel.: +595 21 419-8300</p>
            <p><a href="mailto:funciones@cines.com.py">funciones@cines.com.py</a></p>
          </div>
          <div class="contact-card">
            <h3><i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Consultas y Sugerencias</h3>
            <p><a href="mailto:info@cines.com.py">info@cines.com.py</a></p>
            <p>Fulgencio R. Moreno 176. Asunción - Paraguay</p>
          </div>
          <div class="contact-card social-connect-card">
            <h3><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Canales Oficiales</h3>
            <div class="contact-social-links">
              <a class="contact-social-pill" href="https://www.facebook.com/CinesdelSol/" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-facebook" aria-hidden="true"></i> Facebook</a>
              <a class="contact-social-pill" href="https://twitter.com/CinesPY" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i> X / Twitter</a>
              <a class="contact-social-pill" href="https://onelink.to/6weayk" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> CinemaPop App</a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </main>`;
  return pageShell({ title: 'Contáctenos: consultas, sugerencias y publicidad | Cines PY', description: 'Formulario de contacto de Cines.com.py para consultas, funciones especiales y publicidad en cines.', route: '/contacto/', content, active: 'contacto' });
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
  await writePage('/', pageHome(movies, venues, upcoming));
  await writePage('/cartelera/', pageCatalogue(movies));
  await writePage('/estrenos/', pageUpcoming(upcoming));
  await writePage('/salas/', pageVenues(venues));
  await writePage('/contacto/', pageContact());
  for (const movie of movies) await writePage(`/pelicula/${movie.slug}/`, pageMovie(movie));
  for (const venue of venues) await writePage(`/cine/${venue.slug}/`, pageVenue(venue, movies));
  await fs.mkdir(path.join(DIST, 'assets'), { recursive: true });
  for (const file of ['main.css', 'redesign.css', 'main.js', 'favicon.svg', 'share.svg', 'logo.jpg']) await fs.copyFile(path.join(ROOT, 'assets', file), path.join(DIST, 'assets', file));
  const allRoutes = ['/', '/cartelera/', '/estrenos/', '/salas/', '/contacto/', ...movies.map(m => `/pelicula/${m.slug}/`), ...venues.map(v => `/cine/${v.slug}/`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${allRoutes.map(route => `<url><loc>${xmlEscape(canonical(route))}</loc><lastmod>${new Date(DATA_UPDATED).toISOString().slice(0,10)}</lastmod></url>`).join('')}</urlset>`;
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}${BASE_PATH}sitemap.xml\n`);
  const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Cines PY · Cartelera</title><link>${xmlEscape(canonical('/'))}</link><description>Películas en cartelera en Paraguay</description>${movies.map(m => `<item><title>${xmlEscape(m.title)}</title><link>${xmlEscape(canonical(`/pelicula/${m.slug}/`))}</link><guid>${xmlEscape(canonical(`/pelicula/${m.slug}/`))}</guid><description>${xmlEscape(m.genres.join(' · '))}</description></item>`).join('')}</channel></rss>`;
  await fs.writeFile(path.join(DIST, 'feed.xml'), feed);
  await fs.writeFile(path.join(DIST, '404.html'), pageShell({ title: 'Página no encontrada | Cines PY', description: 'La dirección solicitada no existe.', route: '/404.html', content: `<main id="contenido" class="page-main"><section class="empty-state section-shell"><span class="empty-mark">404</span><h1>Esta función no está en cartelera.</h1><p>La dirección que buscás no existe o cambió.</p><a class="button-primary" href="${local('')}">Volver al inicio <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a></section></main>` }));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  await fs.writeFile(path.join(DIST, 'build-info.json'), JSON.stringify({ updatedAt: DATA_UPDATED, movieCount: movies.length, cinemaCount: venues.length, routeCount: allRoutes.length, upcomingCount: upcoming.length, cinemaProfilesWithPrices: venues.filter(venue => venue.tariffs?.length).length, moviesWithOfficialDetails: movies.filter(movie => Object.keys(movie.officialDetails || {}).length).length }, null, 2));
  console.log(`Build listo: ${movies.length} películas, ${venues.length} salas, ${allRoutes.length} rutas, ${upcoming.length} estrenos.`);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
