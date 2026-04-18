/* ═══════════════════════════════════════════════════════════════════════════ */
/* STATE */
/* ═══════════════════════════════════════════════════════════════════════════ */
let state = {
  nombre:'', cat:'', catIco:'', ciudad:'', comuna:'', dir:'',
  dias:[], desde:'08:00', hasta:'18:00', wsp:'',
  lat: null, lng: null,
  descripcion: '',
  photos: [],
  domicilio: 'no'
};
const TOTAL_STEPS = 4;
let currentStep = 1;
let currentPhotoIndex = 0;

const CAT_BG = {
  comida: 'linear-gradient(135deg,#FDEBD0,#F5C99E)',
  panaderia: 'linear-gradient(135deg,#F5E6C8,#EDD090)',
  mini_market: 'linear-gradient(135deg,#D5E8D4,#A2D09E)',
  belleza: 'linear-gradient(135deg,#F8D7DA,#F0A4AA)',
  servicios: 'linear-gradient(135deg,#DAE8FC,#A4C4E8)',
  emprendimiento: 'linear-gradient(135deg,#E1D5E7,#C4A8D4)',
};

const DOMICILIO_TEXTO = {
  'no': '🏠 Solo en local',
  'si': '🛵 Delivery',
  'ambos': '🏠🛵 Local + Delivery',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* 📸 MANEJO DE FOTOS */
/* ═══════════════════════════════════════════════════════════════════════════ */
const photoInput = document.getElementById('photoInput');
photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (ev) => {
    addPhotoToSlot(currentPhotoIndex, ev.target.result, file);
    updatePhotoCounter();
    updatePreview();
  };
  reader.readAsDataURL(file);
  photoInput.value = '';
});

function triggerPhotoUpload(index) {
  currentPhotoIndex = index;
  photoInput.click();
}

function addPhotoToSlot(index, dataUrl, file) {
  const slot = document.querySelectorAll('.photo-slot')[index];
  const addDiv = slot.querySelector('.slot-add');
  const img = slot.querySelector('img');
  
  state.photos[index] = { dataUrl, file };
  
  addDiv.style.display = 'none';
  img.src = dataUrl;
  img.style.display = 'block';
  slot.classList.add('filled');
}

function removePhoto(index) {
  const slot = document.querySelectorAll('.photo-slot')[index];
  const addDiv = slot.querySelector('.slot-add');
  const img = slot.querySelector('img');
  
  delete state.photos[index];
  
  addDiv.style.display = 'flex';
  img.style.display = 'none';
  img.src = '';
  slot.classList.remove('filled');
  
  updatePhotoCounter();
  updatePreview();
}

function updatePhotoCounter() {
  const count = state.photos.filter(p => p).length;
  const counter = document.getElementById('photoCounter');
  counter.textContent = `${count}/5 fotos`;
  counter.classList.toggle('warning', count === 0);
}

function updateDescCount() {
  const desc = document.getElementById('inp-desc').value;
  state.descripcion = desc;
  document.getElementById('descCount').textContent = `${desc.length}/500`;
  updatePreview();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MINI MAPA Y GEOLOCALIZACIÓN */
/* ═══════════════════════════════════════════════════════════════════════════ */
let miniMap = null, miniMarker = null;

function initMiniMap(lat, lng) {
  const el = document.getElementById('miniMap');
  const geoWrap = document.getElementById('geoWrap');
  el.classList.add('visible');
  geoWrap.style.display = 'block';
  document.getElementById('mapHint').style.display = 'block';
  
  if (!miniMap) {
    miniMap = L.map('miniMap', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19
    }).addTo(miniMap);
    miniMarker = L.marker([lat, lng], { draggable: true }).addTo(miniMap);
    miniMarker.on('dragend', e => {
      const pos = e.target.getLatLng();
      state.lat = pos.lat; state.lng = pos.lng;
      document.getElementById('inp-lat').value = pos.lat;
      document.getElementById('inp-lng').value = pos.lng;
      reverseGeocode(pos.lat, pos.lng);
      updatePreview();
    });
  } else {
    miniMap.setView([lat, lng], 16);
    miniMarker.setLatLng([lat, lng]);
    miniMap.invalidateSize();
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.address) {
      const a = data.address;
      const calle = a.road || a.pedestrian || a.path || '';
      const numero = a.house_number || '';
      const ciudad = a.city || a.town || a.village || a.municipality || '';
      const comuna = a.suburb || a.neighbourhood || a.quarter || '';
      
      state.dir = [calle, numero].filter(Boolean).join(' ') || 'Dirección no disponible';
      state.ciudad = ciudad || '';
      state.comuna = comuna || '';
      
      document.getElementById('inp-dir').value = state.dir;
      document.getElementById('inp-ciudad').value = state.ciudad;
      document.getElementById('inp-comuna').value = state.comuna;
      
      document.getElementById('locDireccion').textContent = state.dir;
      document.getElementById('locCiudad').textContent = state.ciudad;
      document.getElementById('locComuna').textContent = state.comuna;
    }
  } catch(e) { console.log('Error reverse geocode:', e); }
}

function usarUbicacionActual() {
  const btn = document.getElementById('btnGpsLoc');
  if (!navigator.geolocation) { alert('Tu navegador no soporta GPS.'); return; }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Obteniendo ubicación...';
  
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      state.lat = lat; state.lng = lng;
      document.getElementById('inp-lat').value = lat;
      document.getElementById('inp-lng').value = lng;
      
      await reverseGeocode(lat, lng);
      
      document.getElementById('locationInfoCard').style.display = 'block';
      document.getElementById('ubicacionErr').style.display = 'none';
      initMiniMap(lat, lng);
      document.getElementById('geoWrap').className = 'geo-wrap ok';
      updatePreview();
      
      btn.disabled = false;
      btn.innerHTML = '✅ ¡Ubicación obtenida! (Podés ajustar el pin)';
      setErr('f-ubicacion', false);
    },
    err => {
      btn.disabled = false;
      btn.innerHTML = '📍 Obtener mi ubicación actual';
      let msg = 'No se pudo obtener la ubicación.';
      if (err.code === 1) msg = 'Permiso denegado.';
      if (err.code === 2) msg = 'Ubicación no disponible.';
      if (err.code === 3) msg = 'Tiempo agotado.';
      document.getElementById('ubicacionErr').textContent = msg;
      document.getElementById('ubicacionErr').style.display = 'block';
      setErr('f-ubicacion', true);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* NAVEGACIÓN ENTRE PASOS */
/* ═══════════════════════════════════════════════════════════════════════════ */
function goStep(n) {
  if (n > currentStep && !validateStep(currentStep)) return;
  if (n === 4) updatePreview();
  
  currentStep = n;
  document.querySelectorAll('.step-form').forEach(f => f.classList.remove('active'));
  document.getElementById('successScreen').classList.remove('active');
  document.getElementById('step' + n).classList.add('active');
  document.getElementById('progressBar').style.width = (n / TOTAL_STEPS * 100) + '%';
  
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.getElementById('si' + i);
    if (dot) dot.className = 'si-dot' + (i < n ? ' done' : i === n ? ' active' : '');
    const sl = document.getElementById('sl' + i);
    if (sl) sl.className = 'si-line' + (i < n ? ' done' : '');
  }
  document.querySelector('.right-panel').scrollTo({ top: 0, behavior: 'smooth' });
  if (n === 1 && miniMap) setTimeout(() => miniMap.invalidateSize(), 250);
}

function validateStep(step) {
  if (step === 1) {
    const nombre = document.getElementById('inp-nombre').value.trim();
    state.nombre = nombre;
    const diasOk = state.dias.length > 0;
    const ubicacionOk = state.lat !== null;
    
    setErr('f-nombre', !nombre);
    setErr('f-dias', !diasOk);
    setErr('f-ubicacion', !ubicacionOk);
    if (!ubicacionOk) document.getElementById('ubicacionErr').style.display = 'block';
    
    const catErr = document.querySelector('#f-cat .err-msg');
    if (!state.cat) catErr.style.display = 'block'; else catErr.style.display = 'none';
    
    return !!(nombre && state.cat && diasOk && ubicacionOk);
  }
  if (step === 2) {
    const photoCount = state.photos.filter(p => p).length;
    if (photoCount === 0) {
      showToast('📸 Subí al menos 1 foto de tu negocio');
      return false;
    }
    return true;
  }
  if (step === 3) {
    const wsp = document.getElementById('inp-wsp').value.trim();
    setErr('f-wsp', !wsp);
    return !!wsp;
  }
  return true;
}

function setErr(id, hasErr) {
  const f = document.getElementById(id);
  if (!f) return;
  f.classList.toggle('has-err', hasErr);
  const inp = f.querySelector('input,select,textarea');
  if (inp) inp.classList.toggle('err', hasErr);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* CATEGORÍA Y DÍAS */
/* ═══════════════════════════════════════════════════════════════════════════ */
function selectCat(el, cat, ico) {
  document.querySelectorAll('.cat-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.cat = cat; state.catIco = ico;
  document.querySelector('#f-cat .err-msg').style.display = 'none';
  updatePreview();
}

function toggleDay(btn, day) {
  btn.classList.toggle('on');
  const idx = state.dias.indexOf(day);
  if (idx > -1) state.dias.splice(idx, 1); else state.dias.push(day);
  const order = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  state.dias.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  document.getElementById('daysDisplay').textContent = state.dias.length ? state.dias.join(', ') : 'ninguno';
  updatePreview();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* UPDATE PREVIEW */
/* ═══════════════════════════════════════════════════════════════════════════ */
function updatePreview() {
  state.domicilio = document.getElementById('inp-domicilio')?.value || 'no';
  
  const nombre = document.getElementById('inp-nombre')?.value || 'Nombre de tu negocio';
  const desde = document.getElementById('inp-desde')?.value || '08:00';
  const hasta = document.getElementById('inp-hasta')?.value || '18:00';
  const ig = document.getElementById('inp-ig')?.value || '';
  const fb = document.getElementById('inp-fb')?.value || '';
  const desc = state.descripcion || '';

  const catLabel = state.cat ? cap(state.cat.replace(/_/g, ' ')) : 'Categoría';
  const horaText = desde + ' – ' + hasta;
  const dirText = state.dir || 'Dirección no disponible';
  const ciudadComuna = [state.ciudad, state.comuna].filter(Boolean).join(', ') || 'Ubicación';
  const bg = CAT_BG[state.cat] || CAT_BG.comida;
  const ico = state.catIco || '🏪';
  const domicilioTexto = DOMICILIO_TEXTO[state.domicilio] || '🏠 Solo en local';

  const nombreOk = nombre !== 'Nombre de tu negocio' && nombre.length > 0;
  const catOk = !!state.cat;
  const ubicacionOk = !!state.lat;
  const fotosCount = state.photos.filter(p => p).length;
  const contactoOk = !!(document.getElementById('inp-wsp')?.value.trim());
  
  document.getElementById('checkInfo').classList.toggle('done', nombreOk && catOk);
  document.getElementById('checkUbicacion').classList.toggle('done', ubicacionOk);
  document.getElementById('checkFotos').classList.toggle('done', fotosCount >= 1);
  document.getElementById('checkContacto').classList.toggle('done', contactoOk);
  document.getElementById('fotosCount').textContent = fotosCount;

  document.getElementById('pceHeader').style.background = bg;
  document.getElementById('pceCatIco').textContent = ico;
  document.getElementById('pceCatName').textContent = catLabel;

  const mainPhoto = state.photos.find(p => p);
  const photoPlaceholder = document.querySelector('.pce-photo-placeholder');
  const photoImg = document.getElementById('pcePhotoImg');
  if (mainPhoto) {
    photoPlaceholder.style.display = 'none';
    photoImg.style.display = 'block';
    photoImg.src = mainPhoto.dataUrl;
  } else {
    photoPlaceholder.style.display = 'flex';
    photoImg.style.display = 'none';
  }

  document.getElementById('pceName').textContent = nombre;
  document.getElementById('pceDesc').textContent = desc || 'Agregá una descripción para destacar tu negocio';
  document.getElementById('pceDesc').style.opacity = desc ? '1' : '.6';

  const strip = document.getElementById('pcePhotoStrip');
  strip.innerHTML = '';
  state.photos.forEach((p, i) => {
    if (p) {
      const thumb = document.createElement('div');
      thumb.className = 'pce-photo-thumb';
      thumb.innerHTML = `<img src="${p.dataUrl}" alt="Foto ${i+1}"/>`;
      thumb.onclick = () => goStep(2);
      strip.appendChild(thumb);
    }
  });
  if (fotosCount > 0 && fotosCount < 5) {
    const moreBtn = document.createElement('div');
    moreBtn.className = 'pce-more-photos';
    moreBtn.textContent = `+${5 - fotosCount}`;
    moreBtn.onclick = () => goStep(2);
    strip.appendChild(moreBtn);
  }

  document.getElementById('pceDir').textContent = dirText;
  document.getElementById('pceCiudadComuna').textContent = ciudadComuna;
  document.getElementById('pceDias').textContent = state.dias.length ? state.dias.join(', ') : 'No especificado';
  document.getElementById('pceHora').textContent = horaText;

  const wsp = document.getElementById('inp-wsp')?.value || '';
  const wspPub = document.getElementById('chk-wsp-pub')?.checked || false;
  const contactoText = wspPub && wsp ? `WhatsApp: ${wsp}` : 'WhatsApp (privado)';
  document.getElementById('pceContacto').textContent = contactoText;
  
  const redes = [];
  if (ig) redes.push('IG');
  if (fb) redes.push('FB');
  if (state.domicilio !== 'no') redes.push(domicilioTexto);
  document.getElementById('pceRedes').textContent = redes.length ? redes.join(' · ') : 'Sin redes sociales';

  const socialDiv = document.getElementById('pceSocialLinks');
  socialDiv.innerHTML = '';
  
  if (state.domicilio !== 'no') {
    const domBadge = document.createElement('span');
    domBadge.className = `domicilio-badge-preview ${state.domicilio}`;
    domBadge.innerHTML = domicilioTexto;
    domBadge.style.cursor = 'pointer';
    domBadge.onclick = () => goStep(1);
    socialDiv.appendChild(domBadge);
  }
  
  if (ig) {
    const igBtn = document.createElement('a');
    igBtn.className = 'pce-social-btn';
    igBtn.innerHTML = '<span>📸</span> Instagram';
    igBtn.href = '#';
    igBtn.onclick = (e) => { e.preventDefault(); goStep(3); };
    socialDiv.appendChild(igBtn);
  }
  if (fb) {
    const fbBtn = document.createElement('a');
    fbBtn.className = 'pce-social-btn';
    fbBtn.innerHTML = '<span>📘</span> Facebook';
    fbBtn.href = '#';
    fbBtn.onclick = (e) => { e.preventDefault(); goStep(3); };
    socialDiv.appendChild(fbBtn);
  }
  if (wspPub && wsp) {
    const wspBtn = document.createElement('a');
    wspBtn.className = 'pce-social-btn';
    wspBtn.innerHTML = '<span>💬</span> WhatsApp';
    wspBtn.href = '#';
    wspBtn.onclick = (e) => { e.preventDefault(); goStep(3); };
    socialDiv.appendChild(wspBtn);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SUBMIT */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function submitForm() {
  if (!document.getElementById('chk-terms').checked) {
    showToast('Aceptá los términos para continuar 👆');
    return;
  }
  
  const photoCount = state.photos.filter(p => p).length;
  if (photoCount === 0) {
    showToast('📸 Subí al menos 1 foto de tu negocio');
    goStep(2);
    return;
  }
  
  document.getElementById('errorBanner').classList.remove('show');
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando...';

  const desde = document.getElementById('inp-desde').value || '08:00';
  const hasta = document.getElementById('inp-hasta').value || '18:00';
  const diasStr = state.dias.length ? state.dias.join(', ') : 'No especificado';
  const diasAtencion = diasStr + ' · ' + desde + '–' + hasta;

  const formData = new FormData();
  formData.append('csrfmiddlewaretoken', document.querySelector('meta[name="csrf-token"]').content);
  formData.append('nombre', document.getElementById('inp-nombre').value.trim());
  formData.append('tipo', state.cat || 'emprendimiento');
  formData.append('descripcion', state.descripcion);
  formData.append('direccion', state.dir || '');
  formData.append('ciudad', state.ciudad || '');
  formData.append('comuna', state.comuna || '');
  formData.append('dias_atencion', diasAtencion);
  formData.append('whatsapp', document.getElementById('inp-wsp').value.trim());
  formData.append('wsp_publico', document.getElementById('chk-wsp-pub').checked ? 'si' : 'no');
  formData.append('instagram', document.getElementById('inp-ig').value.trim());
  formData.append('facebook', document.getElementById('inp-fb').value.trim());
  formData.append('latitud', state.lat ?? '');
  formData.append('longitud', state.lng ?? '');
  formData.append('domicilio', state.domicilio);
  
  state.photos.forEach((p, i) => {
    if (p && p.file) {
      formData.append(`imagen_${i}`, p.file);
    }
  });

  try {
    const res = await fetch(window.location.href, { method: 'POST', body: formData });
    if (res.ok) {
      document.getElementById('step' + TOTAL_STEPS).classList.remove('active');
      document.getElementById('progressBar').style.width = '100%';
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        document.getElementById('si' + i).className = 'si-dot done';
        const sl = document.getElementById('sl' + i);
        if (sl) sl.className = 'si-line done';
      }
      document.getElementById('successScreen').classList.add('active');
      document.querySelector('.right-panel').scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById('errorMsg').textContent = 'Error del servidor (' + res.status + ').';
      document.getElementById('errorBanner').classList.add('show');
      btn.disabled = false;
      btn.innerHTML = '<span>🚀</span> Publicar mi negocio gratis <span class="btn-arrow">→</span>';
    }
  } catch (e) {
    document.getElementById('errorMsg').textContent = 'Sin conexión. Revisá tu internet.';
    document.getElementById('errorBanner').classList.add('show');
    btn.disabled = false;
    btn.innerHTML = '<span>🚀</span> Publicar mi negocio gratis <span class="btn-arrow">→</span>';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* UTILS */
/* ═══════════════════════════════════════════════════════════════════════════ */
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(16px);background:#241A10;color:#F6F1E9;padding:.65rem 1.4rem;border-radius:100px;font-size:.85rem;font-weight:500;z-index:9999;opacity:0;transition:all .3s;white-space:nowrap;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
  toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(16px)'; }, 3200);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (miniMap && state.lat) miniMap.invalidateSize(); }, 150);
});

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* INICIALIZACIÓN DE EVENT LISTENERS */
/* ═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Categorías
  document.querySelectorAll('.cat-opt').forEach(el => {
    el.addEventListener('click', function() {
      const cat = this.dataset.cat;
      const ico = this.dataset.ico;
      selectCat(this, cat, ico);
    });
  });

  // Días
  document.querySelectorAll('.day-btn').forEach(el => {
    el.addEventListener('click', function() {
      const day = this.dataset.day;
      toggleDay(this, day);
    });
  });

  // Foto slots
  document.querySelectorAll('.photo-slot').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.target.classList.contains('remove-photo')) return;
      const index = parseInt(this.dataset.index);
      triggerPhotoUpload(index);
    });
  });

  // Remove photo buttons
  document.querySelectorAll('.remove-photo').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const index = parseInt(this.dataset.index);
      removePhoto(index);
    });
  });

  // Input events
  document.getElementById('inp-nombre').addEventListener('input', updatePreview);
  document.getElementById('inp-desde').addEventListener('input', updatePreview);
  document.getElementById('inp-hasta').addEventListener('input', updatePreview);
  document.getElementById('inp-domicilio').addEventListener('change', updatePreview);
  document.getElementById('inp-desc').addEventListener('input', updateDescCount);
  document.getElementById('inp-wsp').addEventListener('input', updatePreview);
  document.getElementById('inp-ig').addEventListener('input', updatePreview);
  document.getElementById('inp-fb').addEventListener('input', updatePreview);
  document.getElementById('chk-wsp-pub').addEventListener('change', updatePreview);

  // Botones de navegación
  document.getElementById('btnGpsLoc').addEventListener('click', usarUbicacionActual);
  document.getElementById('btnStep2').addEventListener('click', () => goStep(2));
  document.getElementById('btnBackTo1').addEventListener('click', () => goStep(1));
  document.getElementById('photoContinueBtn').addEventListener('click', () => goStep(3));
  document.getElementById('btnBackTo2').addEventListener('click', () => goStep(2));
  document.getElementById('btnStep4').addEventListener('click', () => goStep(4));
  document.getElementById('btnBackTo3').addEventListener('click', () => goStep(3));
  
  // Botones de edición en preview
  document.getElementById('editPhotosBtn').addEventListener('click', () => goStep(2));
  document.getElementById('editInfoBtn').addEventListener('click', () => goStep(1));
  document.getElementById('editUbicacionBtn').addEventListener('click', () => goStep(1));
  document.getElementById('editHorarioBtn').addEventListener('click', () => goStep(1));
  document.getElementById('editContactoBtn').addEventListener('click', () => goStep(3));
  
  document.getElementById('qaEditInfo').addEventListener('click', () => goStep(1));
  document.getElementById('qaEditPhotos').addEventListener('click', () => goStep(2));
  document.getElementById('qaEditContacto').addEventListener('click', () => goStep(3));
  
  // Submit
  document.getElementById('submitBtn').addEventListener('click', submitForm);
  
  // Ver mapa
  document.getElementById('verMapaBtn').addEventListener('click', () => {
    window.location.href = document.querySelector('meta[name="csrf-token"]')?.getAttribute('data-index-url') || '/';
  });

  // Inicializar contadores
  updatePhotoCounter();
  updateDescCount();
});