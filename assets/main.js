(() => {
  const menuButton = document.querySelector('.nav-toggle');
  const navigation = document.querySelector('#main-navigation');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      navigation.classList.toggle('is-open', open);
      const label = menuButton.querySelector('.sr-only');
      if (label) label.textContent = open ? 'Cerrar menú' : 'Abrir menú';
    });
    navigation.addEventListener('click', event => {
      if (!event.target.closest('a')) return;
      menuButton.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
      const label = menuButton.querySelector('.sr-only');
      if (label) label.textContent = 'Abrir menú';
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || menuButton.getAttribute('aria-expanded') !== 'true') return;
      menuButton.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
      menuButton.querySelector('.sr-only').textContent = 'Abrir menú';
      menuButton.focus();
    });
  }

  for (const image of document.querySelectorAll('.poster-image')) {
    const replaceWithFallback = () => {
      if (!image.isConnected) return;
      const fallback = document.createElement('div');
      const title = (image.alt || 'Afiche no disponible').replace(/^Afiche de\s+/i, '');
      fallback.className = `poster-fallback ${image.className.replace('poster-image', '').trim()}`;
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', `Afiche no disponible: ${title}`);
      fallback.textContent = title;
      image.replaceWith(fallback);
    };
    image.addEventListener('error', replaceWithFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) replaceWithFallback();
  }

  const search = document.querySelector('#film-search');
  const cards = [...document.querySelectorAll('[data-film-card]')];
  const filters = [...document.querySelectorAll('[data-genre-filter]')];
  const count = document.querySelector('#results-count');
  const empty = document.querySelector('#no-results');
  let activeGenre = 'all';

  function applyFilters() {
    const term = (search?.value || '').trim().toLocaleLowerCase('es');
    let visible = 0;
    for (const card of cards) {
      const matchesText = !term || card.dataset.search.includes(term);
      const genres = (card.dataset.genre || '').split('|').filter(Boolean);
      const matchesGenre = activeGenre === 'all' || genres.includes(activeGenre);
      const show = matchesText && matchesGenre;
      card.hidden = !show;
      if (show) visible += 1;
    }
    if (count) count.textContent = `${visible} ${visible === 1 ? 'película' : 'películas'}`;
    if (empty) empty.hidden = visible !== 0;
  }

  search?.addEventListener('input', applyFilters);
  for (const button of filters) {
    button.addEventListener('click', () => {
      activeGenre = button.dataset.genreFilter || 'all';
      for (const item of filters) {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      }
      applyFilters();
    });
  }
})();
