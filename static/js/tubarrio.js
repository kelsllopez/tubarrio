/* ════════════════════════════
   CATEGORÍAS
════════════════════════════ */

const CAT_COLOR = {
  comida:         '#F5A623',
  mini_market:    '#5F8C68',
  belleza:        '#E05C8A',
  panaderia:      '#C0824A',
  servicios:      '#4A90D9',
  emprendimiento: '#9B59B6',
};

const CAT_BG = {
  comida:         'linear-gradient(135deg,#FDEBD0,#F5C99E)',
  mini_market:    'linear-gradient(135deg,#D5E8D4,#A2D09E)',
  belleza:        'linear-gradient(135deg,#F8D7DA,#F0A4AA)',
  panaderia:      'linear-gradient(135deg,#F5E6D3,#DBA882)',
  servicios:      'linear-gradient(135deg,#DAE8FC,#A4C4E8)',
  emprendimiento: 'linear-gradient(135deg,#EDE0F5,#C9A4E0)',
};

const CAT_ICO = {
  comida:         '🍽️',
  mini_market:    '🛒',
  belleza:        '✂️',
  panaderia:      '🥖',
  servicios:      '🔧',
  emprendimiento: '✨',
};

const CAT_LABEL = {
  comida:         'Comida',
  mini_market:    'Almacén / Minimarket',
  belleza:        'Peluquería / Belleza',
  panaderia:      'Panadería',
  servicios:      'Servicios',
  emprendimiento: 'Emprendimiento',
};

const catLabel = c => CAT_LABEL[c] || c;
const catColor = c => CAT_COLOR[c] || '#8A7768';
const catBg    = c => CAT_BG[c]    || 'linear-gradient(135deg,#eee,#ccc)';
const catIco   = c => CAT_ICO[c]   || '📍';

/* ════════════════════════════
   DATOS — inyectados desde el template vía window.TB_CONFIG
════════════════════════════ */

const TB_CONFIG = (window.TB_CONFIG && typeof window.TB_CONFIG === 'object') ? window.TB_CONFIG : {};
const TB_STORAGE_KEY = 'tubarrio:v1';

function $(id){ return document.getElementById(id); }

function normText(s){
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .trim();
}

let statusTimer;
function setStatus(msg, kind = 'warn', duration = 3500){
  const el = $('statusBar');
  if(!el) return;
  clearTimeout(statusTimer);
  el.className = `statusbar on ${kind}`;
  el.textContent = msg;
  if(duration > 0){
    statusTimer = setTimeout(() => { el.className = 'statusbar'; el.textContent = ''; }, duration);
  }
}

function toCoord(v){
  if(v === null || v === undefined) return null;
  if(typeof v === 'number') return Number.isFinite(v) ? v : null;
  if(typeof v === 'string'){
    const t = v.trim();
    if(!t) return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeNegocio(n){
  if(!n || typeof n !== 'object') return n;
  const lat = toCoord(n.lat);
  const lng = toCoord(n.lng);
  const nombre = (n.nombre ?? '').toString();
  const dir = (n.dir ?? '').toString();
  const _search = normText(`${nombre} ${dir}`);
  return {...n, lat, lng, nombre, dir, _search};
}

function normalizeNegocios(list){
  return Array.isArray(list) ? list.map(normalizeNegocio) : [];
}

let NEGOCIOS          = normalizeNegocios(TB_CONFIG.negocios);
const URL_REGISTRAR   = TB_CONFIG.urlRegistrar;
const URL_API         = TB_CONFIG.urlApi;

/* ════════════════════════════
   STATE
════════════════════════════ */

let currentCat = 'all', currentSearch = '', currentSort = 'default';
let panelOpen = false, userLat = null, userLng = null;
let map, markersLayer, activeMarkers = {}, userMarker = null;
let knownIds = new Set(NEGOCIOS.map(n => n.id));
let pollETag = null;
let pollBackoffMs = 30000;
let searchDebounceTimer;
let listRenderSeq = 0;
let nearOnly = false; // cuando GPS está activo, mostrar SOLO dentro del radio

const GPS_RADIO_KM = 5; // radio en km para considerar "cerca"

function adjustFiltersTop(){
  const tb = document.querySelector('.topbar');
  const fl = document.getElementById('filtersBar');
  if(tb && fl) fl.style.top = tb.offsetHeight + 'px';
}

/* ════════════════════════════
   EMPTY — aparece si no hay negocios
════════════════════════════ */

function checkEmpty(){
  const existing = document.querySelector('.empty-map');
  if(existing) existing.remove();
  if(NEGOCIOS.length === 0){
    const div = document.createElement('div');
    div.className = 'empty-map';
    div.innerHTML = `
      <div class="em-ico">📍</div>
      <h3>¡Sé el primero!</h3>
      <p>Aún no hay negocios en TuBarrio.<br>Registrá el tuyo gratis.</p>
      <a href="${URL_REGISTRAR}">+ Registrar mi negocio</a>`;
    document.body.appendChild(div);
  }
}

/* ════════════════════════════
   MAPA
════════════════════════════ */

function initMap(){
  adjustFiltersTop();
  window.addEventListener('resize', adjustFiltersTop);
  const mapEl = document.getElementById('map');
  if(!mapEl || typeof L === 'undefined') return;
  map = L.map('map', {zoomControl: false}).setView([-35.5, -71.5], 6);
  L.control.zoom({position: 'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 19
  }).addTo(map);

  // Cargar preferencias guardadas (sin romper defaults)
  try{
    const st = JSON.parse(localStorage.getItem(TB_STORAGE_KEY) || '{}');
    if(st && typeof st === 'object'){
      if(typeof st.currentCat === 'string') currentCat = st.currentCat;
      if(typeof st.currentSort === 'string') currentSort = st.currentSort;
    }
  } catch {}

  // Clustering si está disponible (escala mejor con muchos negocios)
  if(L.markerClusterGroup){
    markersLayer = L.markerClusterGroup({showCoverageOnHover:false, spiderfyOnMaxZoom:true, chunkedLoading:true});
    markersLayer.addTo(map);
  } else {
    markersLayer = L.layerGroup().addTo(map);
  }

  // Si usamos bounds-filtering para muchos puntos, recalcular al mover el mapa
  map.on('moveend', () => {
    if(filtered().length > 600) renderAll();
  });

  // reflejar estado de filtros/sort en UI
  document.querySelectorAll('.fcat').forEach(b => {
    const cat = b.getAttribute('data-cat');
    const on = cat === currentCat;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('.sort-btn').forEach(b => {
    const txt = (b.textContent || '').toLowerCase();
    const isOn =
      (currentSort === 'default' && txt.includes('recientes')) ||
      (currentSort === 'az' && txt.includes('a')) ||
      (currentSort === 'cercano' && txt.includes('cerca'));
    b.classList.toggle('on', isOn);
  });

  renderAll();
  updateBadge();
  checkEmpty();
  if(NEGOCIOS.length > 0){
    const primero = NEGOCIOS.find(n => n.lat != null && n.lng != null);
    if(primero) map.setView([primero.lat, primero.lng], 14);
    setTimeout(() => togglePanel(true), 600);
  }
  schedulePoll(800);
  document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeDetail(); closeNearbyAlert(); } });
}

/* ════════════════════════════
   POLLING
════════════════════════════ */

function schedulePoll(ms){
  setTimeout(pollNegocios, Math.max(300, ms));
}

async function pollNegocios(){
  const badge = document.getElementById('liveBadge');
  if(badge) badge.classList.add('updating');
  try{
    if(!URL_API) return;
    const headers = {'Accept': 'application/json'};
    if(pollETag) headers['If-None-Match'] = pollETag;

    const res  = await fetch(URL_API, {headers, cache: 'no-cache'});
    if(res.status === 304){
      pollBackoffMs = 30000;
      schedulePoll(pollBackoffMs);
      return;
    }
    if(!res.ok) throw new Error('HTTP ' + res.status);

    const etag = res.headers.get('ETag');
    if(etag) pollETag = etag;

    const data = normalizeNegocios(await res.json());
    const newOnes = [], updatedIds = new Set();
    data.forEach(n => {
      if(!knownIds.has(n.id)){
        newOnes.push(n); knownIds.add(n.id); NEGOCIOS.push(n);
      } else {
        const idx = NEGOCIOS.findIndex(x => x.id === n.id);
        if(idx !== -1 && (NEGOCIOS[idx]._search !== n._search || NEGOCIOS[idx].lat !== n.lat || NEGOCIOS[idx].lng !== n.lng || NEGOCIOS[idx].dias !== n.dias || NEGOCIOS[idx].whatsapp !== n.whatsapp || NEGOCIOS[idx].instagram !== n.instagram || NEGOCIOS[idx].facebook !== n.facebook || NEGOCIOS[idx].cat !== n.cat)){
          NEGOCIOS[idx] = n; updatedIds.add(n.id);
        }
      }
    });
    const serverIds = new Set(data.map(n => n.id));
    NEGOCIOS = NEGOCIOS.filter(n => serverIds.has(n.id));
    knownIds  = new Set(NEGOCIOS.map(n => n.id));
    if(newOnes.length > 0 || updatedIds.size > 0){
      // si el usuario está interactuando con búsqueda/filtros, igual re-render pero con menos costo de comparación
      renderAll(new Set([...newOnes.map(n => n.id), ...updatedIds]));
      updateBadge();
      bumpBadge();
    }
    if(newOnes.length > 0){
      const nombres = newOnes.slice(0, 2).map(n => n.nombre).join(', ');
      const extra   = newOnes.length > 2 ? ` y ${newOnes.length - 2} más` : '';
      showToast(`🆕 ${nombres}${extra} se unió al barrio`);
      const first = newOnes.find(n => n.lat != null && n.lng != null);
      if(first) map.flyTo([first.lat, first.lng], 14, {duration: 1.5});
    }
    pollBackoffMs = 30000;
    schedulePoll(pollBackoffMs);
  } catch(e){
    pollBackoffMs = Math.min(Math.round(pollBackoffMs * 1.6), 180000);
    setStatus('No pude actualizar los negocios. Reintentando…', 'warn', 2500);
    schedulePoll(pollBackoffMs);
  } finally { if(badge) badge.classList.remove('updating'); }
}

function updateBadge(){
  const n = filtered().length;
  const liveCount = document.getElementById('liveCount');
  const zoneCount = document.getElementById('zoneCount');
  const countBadge = document.getElementById('countBadge');
  if(liveCount) liveCount.textContent = NEGOCIOS.length;
  if(zoneCount) zoneCount.textContent = n;
  if(countBadge) countBadge.textContent = n;
}

function bumpBadge(){
  const b = document.getElementById('countBadge');
  if(!b) return;
  b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
}

/* ════════════════════════════
   ICONOS
════════════════════════════ */

function makeIcon(cat){
  const color = catColor(cat), emo = catIco(cat), size = 44, r = 13;
  const id = `sf_${cat}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.3)}" viewBox="0 0 44 57">
    <defs><filter id="${id}"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,.25)"/></filter></defs>
    <path d="M22 2C13.163 2 6 9.163 6 18c0 13 16 37 16 37S38 31 38 18C38 9.163 30.837 2 22 2z" fill="${color}" filter="url(#${id})"/>
    <circle cx="22" cy="18" r="${r}" fill="white" opacity=".95"/>
    <text x="22" y="${18 + r * .38}" text-anchor="middle" dominant-baseline="middle" font-size="${r * .95}">${emo}</text>
  </svg>`;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${Math.round(size * 1.3)}px">${svg}</div>`,
    className: '',
    iconSize: [size, Math.round(size * 1.3)],
    iconAnchor: [size / 2, Math.round(size * 1.3)],
    popupAnchor: [0, -Math.round(size * 1.3) - 2]
  });
}

/* ════════════════════════════
   POPUP
════════════════════════════ */

function popupHTML(n){
  const wspNum = n.whatsapp ? n.whatsapp.replace(/\D/g, '') : '';
  const wspBtn = wspNum ? `<a class="pu-btn pu-wsp" href="https://wa.me/${wspNum}" target="_blank">💬 WhatsApp</a>` : '';
  return `<div class="pu-banner" style="background:${catBg(n.cat)}">
    <div class="pu-ico" style="background:rgba(255,255,255,.6)">${catIco(n.cat)}</div>
    <div class="pu-titles"><div class="pu-name">${n.nombre}</div><div class="pu-cat">${catLabel(n.cat)}</div></div>
  </div>
  <div class="pu-body">
    <div class="pu-row"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${n.dir}</span></div>
    <div class="pu-row"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${n.dias || 'Horario a confirmar'}</span></div>
  </div>
  <div class="pu-foot">
    <button class="pu-btn pu-p" onclick="openDetail(${n.id})">Ver detalle →</button>
    ${wspBtn}
  </div>`;
}

/* ════════════════════════════
   FILTRADO / ORDEN
════════════════════════════ */

function filtered(){
  const q = normText(currentSearch);
  return NEGOCIOS.filter(n => {
    const catOk  = currentCat === 'all' || n.cat === currentCat;
    const textOk = !q || (n._search && n._search.includes(q));
    if(!(catOk && textOk)) return false;

    if(nearOnly && userLat !== null){
      if(n.lat == null || n.lng == null) return false;
      return dist(userLat, userLng, n.lat, n.lng) <= GPS_RADIO_KM;
    }

    return true;
  });
}

function sorted(list){
  if(currentSort === 'az') return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if(currentSort === 'cercano' && userLat !== null) return [...list].sort((a, b) => {
    const da = (a.lat != null && a.lng != null) ? dist(userLat, userLng, a.lat, a.lng) : 9999;
    const db = (b.lat != null && b.lng != null) ? dist(userLat, userLng, b.lat, b.lng) : 9999;
    return da - db;
  });
  return list;
}

/* ════════════════════════════
   RENDER
════════════════════════════ */

function renderAll(newOrUpdatedIds = new Set()){
  let list = sorted(filtered());

  // Bounds filtering opcional: si hay muchos puntos, dibuja solo los visibles.
  if(map && list.length > 600){
    const b = map.getBounds();
    list = list.filter(n => n.lat != null && n.lng != null && b.contains([n.lat, n.lng]));
    setStatus(`Mostrando ${list.length} en pantalla (zoom para ver más)`, 'ok', 1200);
  }
  markersLayer.clearLayers(); activeMarkers = {};
  list.forEach(n => {
    if(n.lat === null || n.lng === null) return;
    const m = L.marker([n.lat, n.lng], {icon: makeIcon(n.cat)})
      .bindPopup(popupHTML(n), {maxWidth: 310, minWidth: 290, closeButton: false})
      .addTo(markersLayer);
    m.on('click', () => highlightCard(n.id));
    activeMarkers[n.id] = m;
  });
  updateBadge();
  renderList(list, newOrUpdatedIds);
  checkEmpty();
}

function renderList(list, newOrUpdatedIds = new Set()){
  const el = document.getElementById('panelList');
  if(!el) return;
  const seq = ++listRenderSeq;
  if(!list.length){
    el.innerHTML = `<div class="no-res"><div class="nr-ico">🔍</div><p>No encontré negocios.<br><a href="#" onclick="clearSearch();return false">Limpiar filtros</a></p></div>`;
    return;
  }

  // Render incremental: para listas grandes evita reflow pesado con innerHTML gigante.
  // Se renderiza en chunks usando requestAnimationFrame.
  const CHUNK = 40;
  el.innerHTML = '';
  let i = 0;
  const frag = document.createDocumentFragment();

  function cardHTML(n, idx){
    const sinCoords = n.lat === null || n.lng === null;
    const isNew     = newOrUpdatedIds.has(n.id);
    const distTxt   = (userLat !== null && n.lat != null && n.lng != null) ? `${dist(userLat, userLng, n.lat, n.lng).toFixed(1)} km · ` : '';
    return `<div class="neg${isNew ? ' is-new' : ''}" id="neg-${n.id}" style="animation-delay:${Math.min(idx * .04, .3)}s"
      onclick="${sinCoords ? `openDetail(${n.id})` : `focusNeg(${n.id})`}" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter')this.click()">
      <div class="neg-top">
        <div class="neg-ico" style="background:${catBg(n.cat)}">${catIco(n.cat)}</div>
        <div class="neg-meta">
          <div class="neg-name">${n.nombre}${isNew ? '<span class="new-pill">NUEVO</span>' : ''}</div>
          <div class="neg-cat-lbl">${catLabel(n.cat)}</div>
        </div>
      </div>
      <div class="neg-rows">
        <div class="neg-row"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${distTxt}${n.dir}</span></div>
        <div class="neg-row"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${n.dias || 'Horario a confirmar'}</span></div>
      </div>
      <div class="neg-foot">
        <span class="status-dot">Activo</span>
        <span class="neg-action" onclick="event.stopPropagation();openDetail(${n.id})">Ver detalle →</span>
      </div>
    </div>`;
  }

  function pump(){
    if(seq !== listRenderSeq) return; // cancelado por un render más nuevo
    const end = Math.min(i + CHUNK, list.length);
    let html = '';
    for(; i < end; i++) html += cardHTML(list[i], i);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    while(tmp.firstChild) frag.appendChild(tmp.firstChild);

    if(i < list.length){
      requestAnimationFrame(pump);
    } else {
      if(seq !== listRenderSeq) return;
      el.appendChild(frag);
    }
  }

  requestAnimationFrame(pump);
}

/* ════════════════════════════
   UI
════════════════════════════ */

function highlightCard(id){
  document.querySelectorAll('.neg').forEach(e => e.classList.remove('active'));
  const c = document.getElementById('neg-' + id);
  if(c){ c.classList.add('active'); c.scrollIntoView({behavior: 'smooth', block: 'nearest'}); }
  if(!panelOpen) togglePanel(true);
}

function focusNeg(id){
  const n = NEGOCIOS.find(x => x.id === id);
  if(!n || n.lat == null || n.lng == null) return;
  highlightCard(id);
  map.flyTo([n.lat, n.lng], 16, {duration: 1.2});
  setTimeout(() => activeMarkers[id]?.openPopup(), 1000);
}

/* ════════════════════════════
   FILTER BY CATEGORIA (con soporte GPS)
════════════════════════════ */

function filterBy(btn, cat){
  document.querySelectorAll('.fcat').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.fcat').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
  currentCat = cat;
  try{ localStorage.setItem(TB_STORAGE_KEY, JSON.stringify({currentCat, currentSort})); } catch {}
  closeNearbyAlert();
  renderAll();

  const lista = filtered();
  if(!lista.length) return;

  const conCoords = lista.filter(n => n.lat != null && n.lng != null);
  if(!conCoords.length) return;

  if(userLat !== null){
    // GPS activo: ordenar por cercanía y evaluar radio
    conCoords.sort((a, b) =>
      dist(userLat, userLng, a.lat, a.lng) - dist(userLat, userLng, b.lat, b.lng)
    );
    const nearest = conCoords[0];
    const d = dist(userLat, userLng, nearest.lat, nearest.lng);

    if(d <= GPS_RADIO_KM){
      // Hay negocios cerca: volar al más cercano y mostrar popup
      map.flyTo([nearest.lat, nearest.lng], 15, {duration: 1.2});
      setTimeout(() => activeMarkers[nearest.id]?.openPopup(), 1000);
      const catNombre = cat === 'all' ? 'negocios' : catLabel(cat).toLowerCase();
      showToast(`📍 ${conCoords.length} ${catNombre} cerca · más cercano: ${nearest.nombre} (${d.toFixed(1)} km)`);
    } else {
      // No hay negocios dentro del radio: mostrar alerta
      map.flyTo([userLat, userLng], 13, {duration: 1.2});
      showNearbyAlert(nearest, d, cat);
    }
  } else {
    // Sin GPS: volar al primero de la categoría
    map.flyTo([conCoords[0].lat, conCoords[0].lng], 12, {duration: 1.2});
  }
}

function onSearch(inp){
  currentSearch = inp.value;
  const searchWrap = document.getElementById('searchWrap');
  if(searchWrap) searchWrap.classList.toggle('has-text', !!inp.value);

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderAll();
    const q = normText(currentSearch);
    if(q.length >= 3){
      const match = NEGOCIOS.find(n => n.lat != null && n.lng != null && n._search && n._search.includes(q));
      if(match) map.flyTo([match.lat, match.lng], 15, {duration: 1.2});
    }
  }, 180);
}

function clearSearch(){
  const inp = document.getElementById('searchInput');
  if(!inp) return;
  inp.value = ''; currentSearch = '';
  document.getElementById('searchWrap')?.classList.remove('has-text');
  renderAll(); inp.focus();
}

function setSort(btn, sort){
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); currentSort = sort;
  if(sort === 'cercano' && userLat === null){ showToast('Activa "Mi ubicación" primero 📍'); return; }
  try{ localStorage.setItem(TB_STORAGE_KEY, JSON.stringify({currentCat, currentSort})); } catch {}
  renderAll();
}

function setSortProgrammatic(sort){
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('on'));
  // best-effort: marcar activo según texto visible actual
  document.querySelectorAll('.sort-btn').forEach(b => {
    const t = (b.textContent || '').toLowerCase();
    const on =
      (sort === 'default' && t.includes('recientes')) ||
      (sort === 'az' && t.includes('a')) ||
      (sort === 'cercano' && t.includes('cerca'));
    b.classList.toggle('on', on);
  });
  try{ localStorage.setItem(TB_STORAGE_KEY, JSON.stringify({currentCat, currentSort})); } catch {}
}

function togglePanel(forceOpen){
  if(forceOpen === true)       panelOpen = true;
  else if(forceOpen === false) panelOpen = false;
  else                         panelOpen = !panelOpen;
  document.getElementById('panel')?.classList.toggle('hidden', !panelOpen);
  document.body.classList.toggle('panel-open', panelOpen);
  setTimeout(() => map?.invalidateSize(), 360);
}

/* ════════════════════════════
   GPS
════════════════════════════ */

function dist(lat1, lng1, lat2, lng2){
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useGPS(){
  const btn = document.getElementById('gpsBtn');
  if(!navigator.geolocation){ setStatus('Tu navegador no soporta geolocalización.', 'err'); return; }
  if(!btn) return;

  // Toggle: si ya estás ubicado, alterna entre "solo cerca" y "ver todo"
  if(btn.classList.contains('is-on') && userLat !== null){
    nearOnly = !nearOnly;
    if(nearOnly){
      setStatus(`Mostrando solo dentro de ${GPS_RADIO_KM} km`, 'ok', 1800);
      setSortProgrammatic('cercano');
      if(!panelOpen) togglePanel(true);
      renderAll();
    } else {
      setStatus('Mostrando todos los negocios', 'ok', 1500);
      renderAll();
    }
    return;
  }

  btn.classList.add('loading');
  btn.classList.remove('is-err');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>Buscando…</span>`;

  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude; userLng = pos.coords.longitude;
      nearOnly = true;

      // Marcador de usuario
      if(userMarker) map.removeLayer(userMarker);
      const icon = L.divIcon({
        html: `<div class="user-marker-wrap"><div class="user-marker-ring"></div><div class="user-marker-inner"></div></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      userMarker = L.marker([userLat, userLng], {icon, zIndexOffset: 1000})
        .addTo(map)
        .bindPopup('<strong>📍 Estás aquí</strong>')
        .openPopup();

      // Evaluar negocios según el filtro activo
      const lista = filtered();
      const conCoords = lista.filter(n => n.lat != null && n.lng != null);

      if(conCoords.length > 0){
        conCoords.sort((a, b) => dist(userLat, userLng, a.lat, a.lng) - dist(userLat, userLng, b.lat, b.lng));
        const nearest = conCoords[0];
        const d = dist(userLat, userLng, nearest.lat, nearest.lng);

        map.flyTo([userLat, userLng], 14, {duration: 1.5});

        if(d <= GPS_RADIO_KM){
          const catNombre = currentCat === 'all' ? 'negocios' : catLabel(currentCat).toLowerCase();
          showToast(`✅ ${conCoords.length} ${catNombre} cerca · más cercano: ${nearest.nombre} (${d.toFixed(1)} km)`);
          setTimeout(() => activeMarkers[nearest.id]?.openPopup(), 1600);
        } else {
          showNearbyAlert(nearest, d, currentCat);
        }
      } else {
        map.flyTo([userLat, userLng], 14, {duration: 1.5});
        showToast('📍 ¡Te encontramos! Sin negocios por aquí aún.');
      }

      btn.classList.remove('loading');
      btn.classList.add('is-on');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span>✓ Ubicado</span>`;

      // UX: al activar GPS, actualizar lista inmediatamente y ordenar por cercanía
      if(!panelOpen) togglePanel(true);
      setSortProgrammatic('cercano');
      setStatus(`Mostrando solo dentro de ${GPS_RADIO_KM} km`, 'ok', 1600);

      // Forzar refresh garantizado (render incremental + recálculo distancias)
      renderAll();
      setTimeout(() => {
        // segundo render para asegurar que no quede un render antiguo “en vuelo”
        renderAll();
      }, 250);
    },
    (err) => {
      btn.classList.remove('loading');
      btn.classList.add('is-err');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg><span>Mi ubicación</span>`;
      nearOnly = false;

      const isSecure = (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
      if(!isSecure){
        setStatus('El GPS requiere HTTPS (o localhost).', 'err', 4500);
      } else if(err && err.code === 1){
        setStatus('Permiso de GPS denegado.', 'err', 3500);
      } else if(err && err.code === 2){
        setStatus('No se pudo obtener tu ubicación.', 'warn', 3500);
      } else if(err && err.code === 3){
        setStatus('GPS tardó demasiado. Intenta de nuevo.', 'warn', 3500);
      } else {
        setStatus('No se pudo acceder al GPS.', 'warn', 3500);
      }
    },
    {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000}
  );
}

/* ════════════════════════════
   NEARBY ALERT — mensaje cuando no hay negocios cerca
════════════════════════════ */

function showNearbyAlert(nearest, distKm, cat){
  closeNearbyAlert(); // cerrar si ya había una

  const catNombre = cat === 'all' ? 'negocios' : catLabel(cat).toLowerCase();
  const div = document.createElement('div');
  div.id = 'nearbyAlert';
  div.innerHTML = `
    <div class="na-ico">📍</div>
    <p class="na-msg">
      No hay <strong>${catNombre}</strong> dentro de ${GPS_RADIO_KM} km de tu ubicación.<br>
      El más cercano está a <strong>${distKm.toFixed(1)} km</strong>:<br>
      <em>${nearest.nombre}</em>
    </p>
    <div class="na-btns">
      <button class="na-btn na-go" onclick="goToNearest(${nearest.id})">Ver dónde queda →</button>
      <button class="na-btn na-close" onclick="closeNearbyAlert()">Cerrar</button>
    </div>`;
  document.body.appendChild(div);
}

function closeNearbyAlert(){
  document.getElementById('nearbyAlert')?.remove();
}

function goToNearest(id){
  closeNearbyAlert();
  focusNeg(id);
  setTimeout(() => openDetail(id), 1300);
}

/* ════════════════════════════
   MODAL
════════════════════════════ */

function openDetail(id){
  const n = NEGOCIOS.find(x => x.id === id); if(!n) return;
  const bann = document.getElementById('mBanner');
  if(!bann) return;
  bann.style.background = catBg(n.cat);
  bann.innerHTML = `<span style="font-size:3rem">${catIco(n.cat)}</span><button class="m-close" onclick="closeDetail()" aria-label="Cerrar">✕</button>`;
  const mName = document.getElementById('mName');
  const mCat = document.getElementById('mCat');
  if(mName) mName.textContent = n.nombre;
  if(mCat) mCat.textContent  = catLabel(n.cat);

  let html = '';
  html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span><strong>Dirección:</strong> ${n.dir}</span></div>`;
  html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span><strong>Atención:</strong> ${n.dias || 'A confirmar'}</span></div>`;

  if(n.instagram){
    const u = n.instagram.startsWith('http') ? n.instagram : `https://instagram.com/${n.instagram.replace('@', '')}`;
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg><span><strong>Instagram:</strong> <a href="${u}" target="_blank" rel="noopener">${n.instagram}</a></span></div>`;
  }
  if(n.facebook){
    const u = n.facebook.startsWith('http') ? n.facebook : `https://facebook.com/${n.facebook}`;
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><span><strong>Facebook:</strong> <a href="${u}" target="_blank" rel="noopener">${n.facebook}</a></span></div>`;
  }
  if(n.whatsapp){
    const num = n.whatsapp.replace(/\D/g, '');
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span><strong>WhatsApp:</strong> <a href="https://wa.me/${num}" target="_blank" rel="noopener">${n.whatsapp}</a></span></div>`;
  }
  if(userLat !== null && n.lat != null && n.lng != null){
    const d = dist(userLat, userLng, n.lat, n.lng);
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span style="color:var(--sage);font-weight:600">A ${d.toFixed(1)} km de tu ubicación</span></div>`;
  }

  const mInfo = document.getElementById('mInfo');
  if(mInfo) mInfo.innerHTML = html;

  let actions = '';
  if(n.whatsapp){ const num = n.whatsapp.replace(/\D/g, ''); actions += `<a class="ma ma-wsp" href="https://wa.me/${num}" target="_blank" rel="noopener">💬 WhatsApp</a>`; }
  if(n.instagram){ const u = n.instagram.startsWith('http') ? n.instagram : `https://instagram.com/${n.instagram.replace('@', '')}`; actions += `<a class="ma ma-ig" href="${u}" target="_blank" rel="noopener">📸 Instagram</a>`; }
  if(n.facebook){  const u = n.facebook.startsWith('http') ? n.facebook : `https://facebook.com/${n.facebook}`; actions += `<a class="ma ma-fb" href="${u}" target="_blank" rel="noopener">📘 Facebook</a>`; }
  actions += `<button class="ma ma-s" onclick="closeDetail()">Cerrar</button>`;

  const mActions = document.getElementById('mActions');
  if(mActions) mActions.innerHTML = actions;
  const modal = document.getElementById('detailModal');
  if(!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail(){
  document.getElementById('detailModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('detailModal')?.addEventListener('click', e => { if(e.target === e.currentTarget) closeDetail(); });

/* ════════════════════════════
   TOAST
════════════════════════════ */

let toastTimer;
function showToast(msg, duration = 3500){
  const t = document.getElementById('toast');
  if(!t) return;
  clearTimeout(toastTimer); t.textContent = msg; t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

window.addEventListener('load', initMap);