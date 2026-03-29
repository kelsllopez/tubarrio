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
const CAT_ICO   = {
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
   DATOS  — inyectados desde el template vía window.TB_CONFIG
════════════════════════════ */
let NEGOCIOS          = window.TB_CONFIG.negocios;
const URL_REGISTRAR   = window.TB_CONFIG.urlRegistrar;
const URL_API         = window.TB_CONFIG.urlApi;

/* ════════════════════════════
   STATE
════════════════════════════ */
let currentCat='all', currentSearch='', currentSort='default';
let panelOpen=false, userLat=null, userLng=null;
let map, markersLayer, activeMarkers={}, userMarker=null;
let knownIds = new Set(NEGOCIOS.map(n=>n.id));

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
  map = L.map('map',{zoomControl:false}).setView([-35.5,-71.5],6);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    attribution:'© OpenStreetMap © CARTO', maxZoom:19
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  renderAll();
  updateBadge();
  checkEmpty();
  if(NEGOCIOS.length > 0){
    const primero = NEGOCIOS.find(n => n.lat !== null && n.lng !== null);
    if(primero) map.setView([primero.lat, primero.lng], 14);
    setTimeout(() => togglePanel(true), 600);
  }
  setInterval(pollNegocios, 30000);
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeDetail(); });
}

/* ════════════════════════════
   POLLING
════════════════════════════ */
async function pollNegocios(){
  const badge = document.getElementById('liveBadge');
  badge.classList.add('updating');
  try{
    const res  = await fetch(URL_API, {headers:{'Accept':'application/json'}, cache:'no-cache'});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const newOnes = [], updatedIds = new Set();
    data.forEach(n => {
      if(!knownIds.has(n.id)){
        newOnes.push(n); knownIds.add(n.id); NEGOCIOS.push(n);
      } else {
        const idx = NEGOCIOS.findIndex(x => x.id===n.id);
        if(idx !== -1 && JSON.stringify(NEGOCIOS[idx]) !== JSON.stringify(n)){
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
      const nombres = newOnes.slice(0,2).map(n => n.nombre).join(', ');
      const extra   = newOnes.length > 2 ? ` y ${newOnes.length-2} más` : '';
      showToast(`🆕 ${nombres}${extra} se unió al barrio`);
      const first = newOnes.find(n => n.lat !== null);
      if(first) map.flyTo([first.lat, first.lng], 14, {duration:1.5});
    }
  } catch(e){ console.warn('Poll falló:', e); }
  finally{ badge.classList.remove('updating'); }
}

function updateBadge(){
  const n = filtered().length;
  document.getElementById('liveCount').textContent  = NEGOCIOS.length;
  document.getElementById('zoneCount').textContent  = n;
  document.getElementById('countBadge').textContent = n;
}
function bumpBadge(){
  const b = document.getElementById('countBadge');
  b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
}

/* ════════════════════════════
   ICONOS
════════════════════════════ */
function makeIcon(cat){
  const color=catColor(cat), emo=catIco(cat), size=44, r=13;
  const id=`sf_${cat}`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size*1.3)}" viewBox="0 0 44 57">
    <defs><filter id="${id}"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,.25)"/></filter></defs>
    <path d="M22 2C13.163 2 6 9.163 6 18c0 13 16 37 16 37S38 31 38 18C38 9.163 30.837 2 22 2z" fill="${color}" filter="url(#${id})"/>
    <circle cx="22" cy="18" r="${r}" fill="white" opacity=".95"/>
    <text x="22" y="${18+r*.38}" text-anchor="middle" dominant-baseline="middle" font-size="${r*.95}">${emo}</text>
  </svg>`;
  return L.divIcon({html:`<div style="width:${size}px;height:${Math.round(size*1.3)}px">${svg}</div>`,className:'',iconSize:[size,Math.round(size*1.3)],iconAnchor:[size/2,Math.round(size*1.3)],popupAnchor:[0,-Math.round(size*1.3)-2]});
}

/* ════════════════════════════
   POPUP
════════════════════════════ */
function popupHTML(n){
  const wspNum = n.whatsapp ? n.whatsapp.replace(/\D/g,'') : '';
  const wspBtn = wspNum ? `<a class="pu-btn pu-wsp" href="https://wa.me/${wspNum}" target="_blank">💬 WhatsApp</a>` : '';
  return `<div class="pu-banner" style="background:${catBg(n.cat)}">
    <div class="pu-ico" style="background:rgba(255,255,255,.6)">${catIco(n.cat)}</div>
    <div class="pu-titles"><div class="pu-name">${n.nombre}</div><div class="pu-cat">${catLabel(n.cat)}</div></div>
  </div>
  <div class="pu-body">
    <div class="pu-row"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${n.dir}</span></div>
    <div class="pu-row"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${n.dias||'Horario a confirmar'}</span></div>
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
  const q = currentSearch.toLowerCase().trim();
  return NEGOCIOS.filter(n => {
    const catOk  = currentCat==='all' || n.cat===currentCat;
    const textOk = !q || n.nombre.toLowerCase().includes(q) || n.dir.toLowerCase().includes(q);
    return catOk && textOk;
  });
}
function sorted(list){
  if(currentSort==='az') return [...list].sort((a,b) => a.nombre.localeCompare(b.nombre,'es'));
  if(currentSort==='cercano' && userLat!==null) return [...list].sort((a,b) => {
    const da = a.lat ? dist(userLat,userLng,a.lat,a.lng) : 9999;
    const db = b.lat ? dist(userLat,userLng,b.lat,b.lng) : 9999;
    return da - db;
  });
  return list;
}

/* ════════════════════════════
   RENDER
════════════════════════════ */
function renderAll(newOrUpdatedIds=new Set()){
  const list = sorted(filtered());
  markersLayer.clearLayers(); activeMarkers={};
  list.forEach(n => {
    if(n.lat===null || n.lng===null) return;
    const m = L.marker([n.lat,n.lng],{icon:makeIcon(n.cat)})
      .bindPopup(popupHTML(n),{maxWidth:310,minWidth:290,closeButton:false})
      .addTo(markersLayer);
    m.on('click', () => highlightCard(n.id));
    activeMarkers[n.id] = m;
  });
  updateBadge();
  renderList(list, newOrUpdatedIds);
  checkEmpty();
}

function renderList(list, newOrUpdatedIds=new Set()){
  const el = document.getElementById('panelList');
  if(!list.length){
    el.innerHTML=`<div class="no-res"><div class="nr-ico">🔍</div><p>No encontré negocios.<br><a href="#" onclick="clearSearch();return false">Limpiar filtros</a></p></div>`;
    return;
  }
  el.innerHTML = list.map((n,i) => {
    const sinCoords = n.lat===null || n.lng===null;
    const isNew     = newOrUpdatedIds.has(n.id);
    const distTxt   = (userLat!==null && n.lat) ? `${dist(userLat,userLng,n.lat,n.lng).toFixed(1)} km · ` : '';
    return `<div class="neg${isNew?' is-new':''}" id="neg-${n.id}" style="animation-delay:${Math.min(i*.04,.3)}s"
      onclick="${sinCoords?`openDetail(${n.id})`:`focusNeg(${n.id})`}" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter')this.click()">
      <div class="neg-top">
        <div class="neg-ico" style="background:${catBg(n.cat)}">${catIco(n.cat)}</div>
        <div class="neg-meta">
          <div class="neg-name">${n.nombre}${isNew?'<span class="new-pill">NUEVO</span>':''}</div>
          <div class="neg-cat-lbl">${catLabel(n.cat)}</div>
        </div>
      </div>
      <div class="neg-rows">
        <div class="neg-row"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${distTxt}${n.dir}</span></div>
        <div class="neg-row"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${n.dias||'Horario a confirmar'}</span></div>
      </div>
      <div class="neg-foot">
        <span class="status-dot">Activo</span>
        <span class="neg-action" onclick="event.stopPropagation();openDetail(${n.id})">Ver detalle →</span>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════
   UI
════════════════════════════ */
function highlightCard(id){
  document.querySelectorAll('.neg').forEach(e => e.classList.remove('active'));
  const c = document.getElementById('neg-'+id);
  if(c){ c.classList.add('active'); c.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  if(!panelOpen) togglePanel(true);
}
function focusNeg(id){
  const n = NEGOCIOS.find(x => x.id===id);
  if(!n || n.lat===null) return;
  highlightCard(id);
  map.flyTo([n.lat,n.lng], 16, {duration:1.2});
  setTimeout(() => activeMarkers[id]?.openPopup(), 1000);
}
function filterBy(btn,cat){
  document.querySelectorAll('.fcat').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); currentCat=cat; renderAll();
  const first = filtered().find(n => n.lat!==null);
  if(first) map.flyTo([first.lat,first.lng], 12, {duration:1.2});
}
function onSearch(inp){
  currentSearch = inp.value;
  document.getElementById('searchWrap').classList.toggle('has-text', !!inp.value);
  renderAll();
  const q = currentSearch.toLowerCase().trim();
  if(q.length >= 3){
    const match = NEGOCIOS.find(n => n.lat!==null && (n.nombre.toLowerCase().includes(q) || n.dir.toLowerCase().includes(q)));
    if(match) map.flyTo([match.lat,match.lng], 15, {duration:1.2});
  }
}
function clearSearch(){
  const inp = document.getElementById('searchInput');
  inp.value=''; currentSearch='';
  document.getElementById('searchWrap').classList.remove('has-text');
  renderAll(); inp.focus();
}
function setSort(btn,sort){
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); currentSort=sort;
  if(sort==='cercano' && userLat===null){ showToast('Activa "Mi ubicación" primero 📍'); return; }
  renderAll();
}
function togglePanel(forceOpen){
  if(forceOpen===true)       panelOpen=true;
  else if(forceOpen===false) panelOpen=false;
  else                       panelOpen=!panelOpen;
  document.getElementById('panel').classList.toggle('hidden', !panelOpen);
  document.body.classList.toggle('panel-open', panelOpen);
  setTimeout(() => map?.invalidateSize(), 360);
}

/* ════════════════════════════
   GPS
════════════════════════════ */
function dist(lat1,lng1,lat2,lng2){
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function useGPS(){
  const btn = document.getElementById('gpsBtn');
  if(!navigator.geolocation){ showToast('Tu navegador no tiene GPS 😅'); return; }
  btn.classList.add('loading');
  btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>Buscando…</span>`;
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLat=pos.coords.latitude; userLng=pos.coords.longitude;
      if(userMarker) map.removeLayer(userMarker);
      const icon = L.divIcon({html:`<div class="user-marker-wrap"><div class="user-marker-ring"></div><div class="user-marker-inner"></div></div>`,className:'',iconSize:[20,20],iconAnchor:[10,10]});
      userMarker = L.marker([userLat,userLng],{icon,zIndexOffset:1000}).addTo(map).bindPopup('<strong>📍 Estás aquí</strong>').openPopup();
      const conCoords = NEGOCIOS.filter(n => n.lat!==null);
      if(conCoords.length > 0){
        conCoords.sort((a,b) => dist(userLat,userLng,a.lat,a.lng) - dist(userLat,userLng,b.lat,b.lng));
        const nearest=conCoords[0], d=dist(userLat,userLng,nearest.lat,nearest.lng);
        if(d<50){ map.flyTo([userLat,userLng],14,{duration:1.5}); showToast(`✅ Más cercano: ${nearest.nombre} (${d.toFixed(1)} km)`); setTimeout(()=>activeMarkers[nearest.id]?.openPopup(),1600); }
        else    { map.flyTo([userLat,userLng],13,{duration:1.5}); showToast('📍 ¡Ubicación encontrada! Sin negocios muy cerca aún.'); }
      } else { map.flyTo([userLat,userLng],14,{duration:1.5}); showToast('📍 ¡Te encontramos!'); }
      btn.classList.remove('loading'); btn.classList.add('located');
      btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span>✓ Ubicado</span>`;
      if(currentSort==='cercano') renderAll();
    },
    () => {
      btn.classList.remove('loading');
      btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg><span>Mi ubicación</span>`;
      showToast('No se pudo acceder al GPS 🙏');
    },
    {enableHighAccuracy:true, timeout:10000, maximumAge:60000}
  );
}

/* ════════════════════════════
   MODAL
════════════════════════════ */
function openDetail(id){
  const n = NEGOCIOS.find(x => x.id===id); if(!n) return;
  const bann = document.getElementById('mBanner');
  bann.style.background = catBg(n.cat);
  bann.innerHTML = `<span style="font-size:3rem">${catIco(n.cat)}</span><button class="m-close" onclick="closeDetail()" aria-label="Cerrar">✕</button>`;
  document.getElementById('mName').textContent = n.nombre;
  document.getElementById('mCat').textContent  = catLabel(n.cat);
  let html = '';
  html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span><strong>Dirección:</strong> ${n.dir}</span></div>`;
  html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span><strong>Atención:</strong> ${n.dias||'A confirmar'}</span></div>`;
  if(n.instagram){
    const u = n.instagram.startsWith('http') ? n.instagram : `https://instagram.com/${n.instagram.replace('@','')}`;
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg><span><strong>Instagram:</strong> <a href="${u}" target="_blank" rel="noopener">${n.instagram}</a></span></div>`;
  }
  if(n.facebook){
    const u = n.facebook.startsWith('http') ? n.facebook : `https://facebook.com/${n.facebook}`;
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><span><strong>Facebook:</strong> <a href="${u}" target="_blank" rel="noopener">${n.facebook}</a></span></div>`;
  }
  if(n.whatsapp){
    const num = n.whatsapp.replace(/\D/g,'');
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span><strong>WhatsApp:</strong> <a href="https://wa.me/${num}" target="_blank" rel="noopener">${n.whatsapp}</a></span></div>`;
  }
  if(userLat!==null && n.lat){
    const d = dist(userLat,userLng,n.lat,n.lng);
    html += `<div class="m-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span style="color:var(--sage);font-weight:600">A ${d.toFixed(1)} km de tu ubicación</span></div>`;
  }
  document.getElementById('mInfo').innerHTML = html;
  let actions = '';
  if(n.whatsapp){ const num=n.whatsapp.replace(/\D/g,''); actions+=`<a class="ma ma-wsp" href="https://wa.me/${num}" target="_blank" rel="noopener">💬 WhatsApp</a>`; }
  if(n.instagram){ const u=n.instagram.startsWith('http')?n.instagram:`https://instagram.com/${n.instagram.replace('@','')}`; actions+=`<a class="ma ma-ig" href="${u}" target="_blank" rel="noopener">📸 Instagram</a>`; }
  if(n.facebook){  const u=n.facebook.startsWith('http')?n.facebook:`https://facebook.com/${n.facebook}`; actions+=`<a class="ma ma-fb" href="${u}" target="_blank" rel="noopener">📘 Facebook</a>`; }
  actions += `<button class="ma ma-s" onclick="closeDetail()">Cerrar</button>`;
  document.getElementById('mActions').innerHTML = actions;
  document.getElementById('detailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDetail(){
  document.getElementById('detailModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('detailModal').addEventListener('click', e => { if(e.target===e.currentTarget) closeDetail(); });

/* ════════════════════════════
   TOAST
════════════════════════════ */
let toastTimer;
function showToast(msg, duration=3500){
  const t = document.getElementById('toast');
  clearTimeout(toastTimer); t.textContent=msg; t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

window.addEventListener('load', initMap);