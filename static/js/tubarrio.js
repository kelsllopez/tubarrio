
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
  belleza:        '💇',
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
   DOMICILIO
════════════════════════════ */

const DOMICILIO_TEXTO = {
  'no': '🏠 Solo en local',
  'si': '🛵 Delivery',
  'ambos': '🏠🛵 Local + Delivery',
};

const DOMICILIO_ICONO = {
  'no': '🏠',
  'si': '🛵',
  'ambos': '🚚',
};

function getDomicilioBadge(domicilio) {
  const texto = DOMICILIO_TEXTO[domicilio] || '🏠 Solo en local';
  const icono = DOMICILIO_ICONO[domicilio] || '🏠';
  const clase = domicilio || 'no';
  
  return `<span class="domicilio-badge-card ${clase}" title="${texto}" style="display:inline-flex !important;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:0.65rem;font-weight:600;margin-left:6px;background:#f0e6dc;color:#6B5B4E;border:1px solid #d4c4b8;white-space:nowrap;">${icono} ${texto}</span>`;
}

function getDomicilioTexto(domicilio) {
  return DOMICILIO_TEXTO[domicilio] || '🏠 Solo en local';
}

function getDomicilioIcono(domicilio) {
  return DOMICILIO_ICONO[domicilio] || '🏠';
}

/* ════════════════════════════
   VERIFICAR SI ESTÁ ABIERTO AHORA
════════════════════════════ */

const DIAS_MAPA = {
  'Dom': 0, 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Mie': 3,
  'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Sab': 6
};

function verificarAbiertoAhora(diasStr) {
  if (!diasStr || diasStr === 'Horario a confirmar' || diasStr === 'No especificado') {
    return { abierto: false, mensaje: 'Horario no disponible', clase: 'cerrado' };
  }
  
  try {
    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
    const diaActual = ahora.getDay();
    
    const partes = diasStr.split('·');
    if (partes.length < 2) return { abierto: false, mensaje: 'Horario no disponible', clase: 'cerrado' };
    
    const diasParte = partes[0].trim();
    const horasParte = partes[1].trim();
    
    const diasArray = diasParte.split(',').map(d => d.trim());
    const diasNumeros = diasArray.map(d => DIAS_MAPA[d]).filter(d => d !== undefined);
    
    if (!diasNumeros.includes(diaActual)) {
      const diasOrdenados = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const hoyIdx = diasOrdenados.findIndex(d => DIAS_MAPA[d] === diaActual);
      
      for (let i = 0; i < 7; i++) {
        const idx = (hoyIdx + i) % 7;
        if (diasNumeros.includes(DIAS_MAPA[diasOrdenados[idx]])) {
          return { abierto: false, mensaje: `Abre el ${diasOrdenados[idx]}`, clase: 'cerrado' };
        }
      }
      return { abierto: false, mensaje: 'Cerrado hoy', clase: 'cerrado' };
    }
    
    const horasMatch = horasParte.match(/(\d{1,2}):(\d{2})[–\-](\d{1,2}):(\d{2})/);
    if (!horasMatch) return { abierto: false, mensaje: 'Horario no disponible', clase: 'cerrado' };
    
    const horaInicio = parseInt(horasMatch[1]) * 60 + parseInt(horasMatch[2]);
    const horaFin = parseInt(horasMatch[3]) * 60 + parseInt(horasMatch[4]);
    
    if (horaActual >= horaInicio && horaActual <= horaFin) {
      return { abierto: true, mensaje: '🟢 Abierto ahora', clase: 'abierto' };
    } else if (horaActual < horaInicio) {
      const falta = horaInicio - horaActual;
      const horas = Math.floor(falta / 60);
      const mins = falta % 60;
      if (horas > 0) {
        return { abierto: false, mensaje: `⏰ Abre en ${horas}h ${mins}m`, clase: 'cerrado' };
      } else {
        return { abierto: false, mensaje: `⏰ Abre en ${mins}m`, clase: 'cerrado' };
      }
    } else {
      return { abierto: false, mensaje: '⚪ Cerrado ahora', clase: 'cerrado' };
    }
  } catch (e) {
    return { abierto: false, mensaje: 'Horario no disponible', clase: 'cerrado' };
  }
}

function getEstadoAbiertoBadge(diasStr) {
  const estado = verificarAbiertoAhora(diasStr);
  if (estado.abierto) {
    return '<span class="estado-badge abierto">🟢 Abierto ahora</span>';
  } else if (estado.mensaje.includes('Abre en')) {
    return `<span class="estado-badge cerrado" title="${estado.mensaje}">⏰ ${estado.mensaje}</span>`;
  } else if (estado.mensaje.includes('Abre el')) {
    return `<span class="estado-badge cerrado">📅 ${estado.mensaje}</span>`;
  } else {
    return '<span class="estado-badge cerrado">⚪ Cerrado</span>';
  }
}

const TB_CONFIG = (window.TB_CONFIG && typeof window.TB_CONFIG === 'object') ? window.TB_CONFIG : {};
const TB_STORAGE_KEY = 'tubarrio:v1';

function $(id){ return document.getElementById(id); }

function normText(s){
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  const comuna = (n.comuna ?? '').toString();
  const ciudad = (n.ciudad ?? '').toString();
  const descripcion = (n.descripcion ?? '').toString();
  const imagenes = Array.isArray(n.imagenes) ? n.imagenes : [];
  const _search = normText(`${nombre} ${dir} ${comuna} ${ciudad} ${descripcion}`);
  const domicilio = n.domicilio || 'no';
  const domicilio_texto = n.domicilio_texto || DOMICILIO_TEXTO[domicilio] || '🏠 Solo en local';
  
  return {
    ...n,
    lat,
    lng,
    nombre,
    dir,
    comuna,
    ciudad,
    verificado: n.verificado || false,
    visitas: n.visitas || 0,
    descripcion,
    imagenes,
    domicilio,
    domicilio_texto,
    _search
  };
}

function normalizeNegocios(list){
  return Array.isArray(list) ? list.map(normalizeNegocio) : [];
}

let NEGOCIOS          = normalizeNegocios(TB_CONFIG.negocios);
const URL_REGISTRAR   = TB_CONFIG.urlRegistrar;
const URL_API         = TB_CONFIG.urlApi;

let currentCat = 'all', currentSearch = '', currentSort = 'default';
let panelOpen = false, userLat = null, userLng = null;
let map, markersLayer, activeMarkers = {}, userMarker = null;
let knownIds = new Set(NEGOCIOS.map(n => n.id));
let pollETag = null;
let pollBackoffMs = 30000;
let searchDebounceTimer;
let listRenderSeq = 0;
let nearOnly = false;

const GPS_RADIO_KM = 5;

function adjustFiltersTop(){
  const tb = document.querySelector('.topbar');
  const fl = document.getElementById('filtersBar');
  if(tb && fl) fl.style.top = tb.offsetHeight + 'px';
}

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
  map = L.map('map', {zoomControl: false}).setView([-39.2333, -72.3833], 14);
  L.control.zoom({position: 'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 19
  }).addTo(map);

  try{
    const st = JSON.parse(localStorage.getItem(TB_STORAGE_KEY) || '{}');
    if(st && typeof st === 'object'){
      if(typeof st.currentCat === 'string') currentCat = st.currentCat;
      if(typeof st.currentSort === 'string') currentSort = st.currentSort;
    }
  } catch {}

  if(L.markerClusterGroup){
    markersLayer = L.markerClusterGroup({showCoverageOnHover:false, spiderfyOnMaxZoom:true, chunkedLoading:true});
    markersLayer.addTo(map);
  } else {
    markersLayer = L.layerGroup().addTo(map);
  }

  map.on('moveend', () => {
    if(filtered().length > 600) renderAll();
  });

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
        if(idx !== -1 && (
          NEGOCIOS[idx]._search !== n._search ||
          NEGOCIOS[idx].lat !== n.lat ||
          NEGOCIOS[idx].lng !== n.lng ||
          NEGOCIOS[idx].dias !== n.dias ||
          NEGOCIOS[idx].whatsapp !== n.whatsapp ||
          NEGOCIOS[idx].instagram !== n.instagram ||
          NEGOCIOS[idx].facebook !== n.facebook ||
          NEGOCIOS[idx].verificado !== n.verificado ||
          NEGOCIOS[idx].comuna !== n.comuna ||
          NEGOCIOS[idx].ciudad !== n.ciudad ||
          NEGOCIOS[idx].descripcion !== n.descripcion ||
          NEGOCIOS[idx].domicilio !== n.domicilio ||
          JSON.stringify(NEGOCIOS[idx].imagenes) !== JSON.stringify(n.imagenes)
        )){
          NEGOCIOS[idx] = n; updatedIds.add(n.id);
        }
      }
    });
    const serverIds = new Set(data.map(n => n.id));
    NEGOCIOS = NEGOCIOS.filter(n => serverIds.has(n.id));
    knownIds  = new Set(NEGOCIOS.map(n => n.id));
    if(newOnes.length > 0 || updatedIds.size > 0){
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

function popupHTML(n){
  const wspNum = n.whatsapp ? n.whatsapp.replace(/\D/g, '') : '';
  const wspBtn = wspNum ? `<a class="pu-btn pu-wsp" href="https://wa.me/${wspNum}" target="_blank">💬 WhatsApp</a>` : '';
  const verificadoBadge = n.verificado ? '<span class="verified-badge-modal" title="Negocio verificado">✓ Verificado</span>' : '';
  const ubicacionCompleta = [n.dir, n.comuna, n.ciudad].filter(Boolean).join(', ');
  
  const estado = verificarAbiertoAhora(n.dias);
  const estadoBadge = estado.abierto 
    ? '<span class="estado-badge-popup abierto">🟢 Abierto ahora</span>' 
    : '<span class="estado-badge-popup cerrado">⚪ Cerrado</span>';
  
  const domicilioBadge = `<span class="domicilio-badge-popup ${n.domicilio || 'no'}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:0.7rem;font-weight:600;">${getDomicilioIcono(n.domicilio || 'no')} ${getDomicilioTexto(n.domicilio || 'no')}</span>`;

  let imgHtml = '';
  if (n.imagenes && n.imagenes.length > 0) {
    imgHtml = `<div class="pu-img" style="background-image:url('${n.imagenes[0]}')"></div>`;
  }

  return `<div class="pu-banner" style="background:${catBg(n.cat)}">
    ${imgHtml}
    <div class="pu-ico" style="background:rgba(255,255,255,.6)">${catIco(n.cat)}</div>
    <div class="pu-titles"><div class="pu-name">${n.nombre} ${verificadoBadge}</div><div class="pu-cat">${catLabel(n.cat)}</div></div>
  </div>
  <div class="pu-body">
    ${n.descripcion ? `<div class="pu-row pu-desc">${n.descripcion}</div>` : ''}
    <div class="pu-row"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${ubicacionCompleta}</span></div>
    <div class="pu-row"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${n.dias || 'Horario a confirmar'}</span></div>
    <div class="pu-row" style="justify-content:space-between">
      ${estadoBadge}
      ${domicilioBadge}
    </div>
  </div>
  <div class="pu-foot">
    <button class="pu-btn pu-p" onclick="openDetail(${n.id})">Ver detalle →</button>
    ${wspBtn}
    <button class="pu-btn report-btn-popup" onclick="abrirReporte(${n.id}, '${n.nombre.replace(/'/g, "\\'")}')" title="Reportar problema">⚠️</button>
  </div>`;
}

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

function renderAll(newOrUpdatedIds = new Set()){
  let list = sorted(filtered());

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

  const CHUNK = 40;
  el.innerHTML = '';
  let i = 0;
  const frag = document.createDocumentFragment();

  function cardHTML(n, idx){
    const sinCoords = n.lat === null || n.lng === null;
    const isNew     = newOrUpdatedIds.has(n.id);
    const distTxt   = (userLat !== null && n.lat != null && n.lng != null) ? `${dist(userLat, userLng, n.lat, n.lng).toFixed(1)} km · ` : '';
    const verificadoBadge = n.verificado ? '<span class="verified-badge-list" title="Negocio verificado">✓</span>' : '';
    const ubicacionCompleta = [n.dir, n.comuna, n.ciudad].filter(Boolean).join(', ');
    
    const domicilioBadge = getDomicilioBadge(n.domicilio || 'no');

    const imgHtml = `<div class="neg-ico" style="background:${catBg(n.cat)}">${catIco(n.cat)}</div>`;

    return `<div class="neg${isNew ? ' is-new' : ''}" id="neg-${n.id}" style="animation-delay:${Math.min(idx * .04, .3)}s"
      onclick="${sinCoords ? `openDetail(${n.id})` : `focusNeg(${n.id})`}" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter')this.click()">
      <div class="neg-top">
        ${imgHtml}
        <div class="neg-meta">
          <div class="neg-name">
            ${n.nombre} ${verificadoBadge} ${isNew ? '<span class="new-pill">NUEVO</span>' : ''}
            ${domicilioBadge}
          </div>
          <div class="neg-cat-lbl">${catLabel(n.cat)}</div>
        </div>
      </div>
      ${n.descripcion ? `<div class="neg-desc">${n.descripcion}</div>` : ''}
      <div class="neg-rows">
        <div class="neg-row"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${distTxt}${ubicacionCompleta}</span></div>
        <div class="neg-row"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${n.dias || 'Horario a confirmar'}</span></div>
      </div>
      <div class="neg-foot">
        ${getEstadoAbiertoBadge(n.dias)}
        <span class="neg-action" onclick="event.stopPropagation();openDetail(${n.id})">Ver detalle →</span>
      </div>
    </div>`;
  }

  function pump(){
    if(seq !== listRenderSeq) return;
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
    conCoords.sort((a, b) =>
      dist(userLat, userLng, a.lat, a.lng) - dist(userLat, userLng, b.lat, b.lng)
    );
    const nearest = conCoords[0];
    const d = dist(userLat, userLng, nearest.lat, nearest.lng);

    if(d <= GPS_RADIO_KM){
      map.flyTo([nearest.lat, nearest.lng], 15, {duration: 1.2});
      setTimeout(() => activeMarkers[nearest.id]?.openPopup(), 1000);
      const catNombre = cat === 'all' ? 'negocios' : catLabel(cat).toLowerCase();
      showToast(`📍 ${conCoords.length} ${catNombre} cerca · más cercano: ${nearest.nombre} (${d.toFixed(1)} km)`);
    } else {
      map.flyTo([userLat, userLng], 13, {duration: 1.2});
      showNearbyAlert(nearest, d, cat);
    }
  } else {
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

function dist(lat1, lng1, lat2, lng2){
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useGPS(){
  const btn = document.getElementById('gpsBtn');
  if(!navigator.geolocation){ setStatus('Tu navegador no soporta geolocalización.', 'err'); return; }
  if(!btn) return;

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

      if(userMarker) map.removeLayer(userMarker);
      const icon = L.divIcon({
        html: `<div class="user-marker-wrap"><div class="user-marker-ring"></div><div class="user-marker-inner"></div></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      userMarker = L.marker([userLat, userLng], {icon, zIndexOffset: 1000})
        .addTo(map)
        .bindPopup('<strong>📍 Estás aquí</strong>')
        .openPopup();

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

      if(!panelOpen) togglePanel(true);
      setSortProgrammatic('cercano');
      setStatus(`Mostrando solo dentro de ${GPS_RADIO_KM} km`, 'ok', 1600);

      renderAll();
      setTimeout(() => { renderAll(); }, 250);
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

function showNearbyAlert(nearest, distKm, cat){
  closeNearbyAlert();

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

let currentNegocioId = null;
let currentNegocioData = null;

function switchTab(tabName){
  document.querySelectorAll('.m-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
  
  document.querySelectorAll('.m-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
}

function openDetail(id){
  const n = NEGOCIOS.find(x => x.id === id);
  if(!n) return;
  
  currentNegocioId = id;
  currentNegocioData = n;

  const bann = document.getElementById('mBanner');
  const mName = document.getElementById('mName');
  const mCat = document.getElementById('mCat');
  const mInfo = document.getElementById('mInfo');
  const mActions = document.getElementById('mActions');
  const fotosCount = document.getElementById('fotosCount');
  
  if(!bann || !mName || !mCat || !mInfo || !mActions) return;

  if (n.imagenes && n.imagenes.length > 0) {
    bann.style.cssText = `
      background: url('${n.imagenes[0]}') center/cover no-repeat;
      position: relative;
    `;
    bann.innerHTML = `
      <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.15) 100%);border-radius:0"></div>
      <span style="font-size:3rem;position:relative;z-index:1;text-shadow:0 2px 8px rgba(0,0,0,.4)">${catIco(n.cat)}</span>
      <button class="m-close" onclick="closeDetail()" aria-label="Cerrar" style="z-index:2">✕</button>
    `;
  } else {
    bann.style.cssText = `background: ${catBg(n.cat)};`;
    bann.innerHTML = `
      <span style="font-size:3rem">${catIco(n.cat)}</span>
      <button class="m-close" onclick="closeDetail()" aria-label="Cerrar">✕</button>
    `;
  }

  mName.innerHTML = `${n.nombre}${n.verificado ? ' <span class="verified-badge-modal" title="Negocio verificado">✓ Verificado</span>' : ''}`;
  mCat.textContent = catLabel(n.cat);

  const numFotos = (n.imagenes && Array.isArray(n.imagenes)) ? n.imagenes.length : 0;
  if(fotosCount) fotosCount.textContent = numFotos;

  const ubicacion = [n.dir, n.comuna, n.ciudad].filter(Boolean).join(', ');
  let htmlDetalles = '';

  if (n.descripcion) {
    htmlDetalles += `<div class="m-desc">${n.descripcion}</div>`;
  }

  htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span><strong>Dirección:</strong> ${ubicacion}</span></div>`;
  htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span><strong>Atención:</strong> ${n.dias || 'A confirmar'}</span></div>`;

  const estadoAbierto = verificarAbiertoAhora(n.dias);
  htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span style="color:${estadoAbierto.abierto ? 'var(--sage)' : 'var(--dust)'};font-weight:600">${estadoAbierto.mensaje}</span></div>`;

  htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"/><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/></svg><span><strong>Delivery:</strong> ${getDomicilioTexto(n.domicilio || 'no')}</span></div>`;

  if(n.instagram){
    const u = n.instagram.startsWith('http') ? n.instagram : `https://instagram.com/${n.instagram.replace('@','')}`;
    htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg><span><strong>Instagram:</strong> <a href="${u}" target="_blank" rel="noopener">${n.instagram}</a></span></div>`;
  }
  if(n.facebook){
    const u = n.facebook.startsWith('http') ? n.facebook : `https://facebook.com/${n.facebook}`;
    htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><span><strong>Facebook:</strong> <a href="${u}" target="_blank" rel="noopener">${n.facebook}</a></span></div>`;
  }
  if(n.whatsapp){
    const num = n.whatsapp.replace(/\D/g,'');
    htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span><strong>WhatsApp:</strong> <a href="https://wa.me/${num}" target="_blank" rel="noopener">${n.whatsapp}</a></span></div>`;
  }
  if(userLat !== null && n.lat != null && n.lng != null){
    const d = dist(userLat, userLng, n.lat, n.lng);
    htmlDetalles += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span style="color:var(--sage);font-weight:600">A ${d.toFixed(1)} km de tu ubicación</span></div>`;
  }

  mInfo.innerHTML = htmlDetalles;

  const mGallery = document.getElementById('mGallery');
  const imgs = (n.imagenes && Array.isArray(n.imagenes)) ? n.imagenes : [];
  
  if(imgs.length > 0){
    let htmlFotos = `<div class="m-gallery-grid-fotos">`;
    imgs.forEach((imgUrl, i) => {
      const imagenesArray = JSON.stringify(imgs).replace(/"/g, '&quot;');
      htmlFotos += `
        <div class="m-gallery-item-foto" onclick="openImageViewer(${i}, '${imagenesArray}')">
          <img src="${imgUrl}" alt="Foto ${i + 1}" loading="lazy" onerror="this.style.display='none'"/>
        </div>`;
    });
    htmlFotos += `</div>`;
    mGallery.innerHTML = htmlFotos;
  } else {
    mGallery.innerHTML = `
      <div class="m-no-fotos">
        <div class="m-no-fotos-ico">📸</div>
        <p>Este negocio aún no tiene fotos.</p>
      </div>`;
  }

  let actions = '';
  if(n.whatsapp){ 
    const num = n.whatsapp.replace(/\D/g,''); 
    actions += `<a class="ma ma-wsp" href="https://wa.me/${num}" target="_blank" rel="noopener">💬 WhatsApp</a>`; 
  }
  if(n.instagram){ 
    const u = n.instagram.startsWith('http') ? n.instagram : `https://instagram.com/${n.instagram.replace('@','')}`; 
    actions += `<a class="ma ma-ig" href="${u}" target="_blank" rel="noopener">📸 Instagram</a>`; 
  }
  if(n.facebook){  
    const u = n.facebook.startsWith('http') ? n.facebook : `https://facebook.com/${n.facebook}`; 
    actions += `<a class="ma ma-fb" href="${u}" target="_blank" rel="noopener">📘 Facebook</a>`; 
  }
  actions += `<button class="ma report-btn-modal" onclick="abrirReporte(${n.id}, '${n.nombre.replace(/'/g, "\\'")}'); closeDetail();">⚠️ Reportar problema</button>`;
  actions += `<button class="ma ma-s" onclick="closeDetail()">Cerrar</button>`;
  mActions.innerHTML = actions;

  switchTab('detalles');

  document.getElementById('detailModal')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail(){
  document.getElementById('detailModal')?.classList.remove('open');
  document.body.style.overflow = '';
  currentNegocioId = null;
  currentNegocioData = null;
}

function openImageViewer(startIndex, imagenesString) {
  let imagenes;
  try {
    imagenes = JSON.parse(imagenesString.replace(/&quot;/g, '"'));
  } catch(e) {
    console.error('Error al parsear imágenes:', e);
    return;
  }

  if (!imagenes || !imagenes.length) return;

  document.getElementById('tbImageViewer')?.remove();

  const viewer = document.createElement('div');
  viewer.id = 'tbImageViewer';
  viewer.innerHTML = `
    <div class="iv-overlay" onclick="document.getElementById('tbImageViewer').remove()"></div>
    <div class="iv-container">
      <button class="iv-close" onclick="document.getElementById('tbImageViewer').remove()">✕</button>
      
      <button class="iv-nav iv-prev" id="ivPrev">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <div class="iv-main">
        <div class="iv-image-wrapper">
          <img id="ivImg" src="${imagenes[startIndex]}" alt="Foto ${startIndex + 1}"/>
        </div>
        <div class="iv-info">
          <span class="iv-counter" id="ivCounter">${startIndex + 1} / ${imagenes.length}</span>
        </div>
      </div>
      
      <button class="iv-nav iv-next" id="ivNext">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
    
    <div class="iv-thumbnails" id="ivThumbnails"></div>
  `;
  document.body.appendChild(viewer);

  let current = startIndex;
  const imgEl = document.getElementById('ivImg');
  const counterEl = document.getElementById('ivCounter');
  const prevBtn = document.getElementById('ivPrev');
  const nextBtn = document.getElementById('ivNext');
  const thumbnailsEl = document.getElementById('ivThumbnails');

  imagenes.forEach((img, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `iv-thumb ${idx === current ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${img}" alt="Miniatura ${idx + 1}"/>`;
    thumb.onclick = () => goTo(idx);
    thumbnailsEl.appendChild(thumb);
  });

  function goTo(idx) {
    if (idx < 0 || idx >= imagenes.length) return;
    
    current = idx;
    imgEl.style.opacity = '0';
    
    setTimeout(() => {
      imgEl.src = imagenes[current];
      imgEl.style.opacity = '1';
    }, 150);
    
    counterEl.textContent = `${current + 1} / ${imagenes.length}`;
    
    document.querySelectorAll('.iv-thumb').forEach((thumb, i) => {
      thumb.classList.toggle('active', i === current);
    });
    
    prevBtn.style.opacity = current === 0 ? '0.3' : '1';
    prevBtn.style.pointerEvents = current === 0 ? 'none' : 'auto';
    nextBtn.style.opacity = current === imagenes.length - 1 ? '0.3' : '1';
    nextBtn.style.pointerEvents = current === imagenes.length - 1 ? 'none' : 'auto';
  }

  prevBtn.onclick = () => goTo(current - 1);
  nextBtn.onclick = () => goTo(current + 1);
  
  goTo(startIndex);

  const onKey = (e) => {
    if (e.key === 'Escape') { 
      viewer.remove(); 
      document.removeEventListener('keydown', onKey); 
    }
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(current - 1);
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(current + 1);
    }
  };
  document.addEventListener('keydown', onKey);
  
  const observer = new MutationObserver(() => {
    if (!document.body.contains(viewer)) {
      document.removeEventListener('keydown', onKey);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.getElementById('detailModal')?.addEventListener('click', e => {
  if(e.target === e.currentTarget) closeDetail();
});

let toastTimer;
function showToast(msg, duration = 3500){
  const t = document.getElementById('toast');
  if(!t) return;
  clearTimeout(toastTimer); t.textContent = msg; t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ════════════════════════════
   FUNCIONES DE REPORTE
════════════════════════════ */

let reporteNegocioId = null;

function abrirReporte(negocioId, negocioNombre) {
  reporteNegocioId = negocioId;
  const modal = document.getElementById('modalReporte');
  const inputNegocioId = document.getElementById('reporte_negocio_id');
  const titulo = document.getElementById('reporteModalTitulo');
  
  if (inputNegocioId) inputNegocioId.value = negocioId;
  if (titulo && negocioNombre) {
    titulo.innerHTML = `⚠️ Reportar: ${negocioNombre.substring(0, 40)}`;
  }
  
  const form = document.getElementById('formReporte');
  const exitoDiv = document.getElementById('reporteExito');
  if (form) form.style.display = 'block';
  if (exitoDiv) exitoDiv.style.display = 'none';
  if (form) form.reset();
  
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function abrirReporteGeneral() {
  reporteNegocioId = null;
  const modal = document.getElementById('modalReporte');
  const inputNegocioId = document.getElementById('reporte_negocio_id');
  const titulo = document.getElementById('reporteModalTitulo');
  
  if (inputNegocioId) inputNegocioId.value = '';
  if (titulo) titulo.innerHTML = '⚠️ Reportar problema general';
  
  const form = document.getElementById('formReporte');
  const exitoDiv = document.getElementById('reporteExito');
  if (form) form.style.display = 'block';
  if (exitoDiv) exitoDiv.style.display = 'none';
  if (form) form.reset();
  
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarModalReporte() {
  const modal = document.getElementById('modalReporte');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  reporteNegocioId = null;
}

document.getElementById('formReporte')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const tipo = document.getElementById('reporte_tipo')?.value;
  const descripcion = document.getElementById('reporte_desc')?.value;
  const email = document.getElementById('reporte_email')?.value;
  const privacidad = document.getElementById('reporte_privacidad')?.checked;
  const negocioId = document.getElementById('reporte_negocio_id')?.value;
  
  if (!tipo || !descripcion) {
    showToast('❌ Completa todos los campos requeridos', 2500);
    return;
  }
  
  if (!privacidad) {
    showToast('📋 Acepta la política de privacidad para continuar', 2500);
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<div class="spinner"></div> Enviando...';
  submitBtn.disabled = true;
  
  try {
    const formData = new FormData();
    formData.append('negocio_id', negocioId || '');
    formData.append('tipo', tipo);
    formData.append('descripcion', descripcion);
    formData.append('email', email || '');
    
    const urlApiReporte = '/api/reportar/';
    
    const response = await fetch(urlApiReporte, {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRFToken': getCookie('csrftoken')
      }
    });
    
    if (response.ok) {
      const formElement = document.getElementById('formReporte');
      const exitoDiv = document.getElementById('reporteExito');
      if (formElement) formElement.style.display = 'none';
      if (exitoDiv) exitoDiv.style.display = 'block';
      
      showToast('✅ Reporte enviado, ¡gracias por ayudar a TuBarrio!', 3500);
      
      setTimeout(() => {
        cerrarModalReporte();
      }, 3000);
    } else {
      throw new Error('Error al enviar');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('❌ Error al enviar, intenta de nuevo más tarde', 3500);
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
});

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

document.getElementById('modalReporte')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) cerrarModalReporte();
});

window.addEventListener('load', initMap);