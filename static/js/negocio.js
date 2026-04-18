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
/* 📸 MANEJO DE FOTOS - VERSIÓN CORREGIDA CON SELECCIÓN MÚLTIPLE             */
/* ═══════════════════════════════════════════════════════════════════════════ */
const photoInput = document.getElementById('photoInput');

photoInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  const currentCount = state.photos.filter(p => p).length;
  const availableSlots = 5 - currentCount;

  if (availableSlots === 0) {
    showToast('📸 Ya tienes 5 fotos. Eliminá algunas para agregar más.');
    photoInput.value = '';
    return;
  }

  // Calcular los slots vacíos de forma SINCRÓNICA antes de abrir ningún FileReader
  const emptySlots = [];
  for (let i = 0; i < 5; i++) {
    if (!state.photos[i]) emptySlots.push(i);
  }

  const photosToAdd = files.slice(0, availableSlots);

  photosToAdd.forEach((file, i) => {
    const slotIndex = emptySlots[i];
    if (slotIndex === undefined) return;

    // ✅ CLAVE: Reservar el slot INMEDIATAMENTE (sincrónico) antes de abrir el reader
    // Así el siguiente archivo no reutiliza el mismo slot vacío
    state.photos[slotIndex] = { dataUrl: null, file };

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Actualizar el dataUrl una vez que el reader terminó
      state.photos[slotIndex].dataUrl = ev.target.result;
      renderPhotoSlot(slotIndex, ev.target.result, file);
      updatePhotoCounter();
      updatePreview();
    };
    reader.readAsDataURL(file);
  });

  if (files.length > availableSlots) {
    showToast(`📸 Se agregaron ${availableSlots} fotos. Máximo 5 en total.`);
  }

  // Limpiar el input para poder seleccionar más fotos después
  photoInput.value = '';
});

function renderPhotoSlot(index, dataUrl, file) {
  const slots = document.querySelectorAll('.photo-slot');
  if (index >= slots.length) return;

  const slot = slots[index];
  const addDiv = slot.querySelector('.slot-add');
  const img = slot.querySelector('img');
  const removeBtn = slot.querySelector('.remove-photo');

  addDiv.style.display = 'none';
  img.src = dataUrl;
  img.style.display = 'block';
  slot.classList.add('filled');

  if (removeBtn) {
    removeBtn.style.display = 'flex';
  }
}

function addPhotoToSlot(index, dataUrl, file) {
  // Guardar en el estado (solo si no está ya reservado)
  state.photos[index] = { dataUrl, file };
  renderPhotoSlot(index, dataUrl, file);
}

function removePhoto(index) {
  const slots = document.querySelectorAll('.photo-slot');
  if (index >= slots.length) return;

  const slot = slots[index];
  const addDiv = slot.querySelector('.slot-add');
  const img = slot.querySelector('img');
  const removeBtn = slot.querySelector('.remove-photo');

  // Eliminar del estado
  delete state.photos[index];

  // Resetear UI
  addDiv.style.display = 'flex';
  img.style.display = 'none';
  img.src = '';
  slot.classList.remove('filled');

  if (removeBtn) {
    removeBtn.style.display = 'none';
  }

  updatePhotoCounter();
  updatePreview();
}

function triggerPhotoUpload() {
  const currentCount = state.photos.filter(p => p).length;
  if (currentCount >= 5) {
    showToast('📸 Ya tienes 5 fotos. Eliminá algunas para agregar más.');
    return;
  }
  photoInput.click();
}

function updatePhotoCounter() {
  const count = state.photos.filter(p => p).length;
  const counter = document.getElementById('photoCounter');
  if (counter) {
    counter.textContent = `${count}/5 fotos`;
    counter.classList.toggle('warning', count === 0);
  }
}

function clearAllPhotos() {
  if (confirm('¿Eliminar todas las fotos?')) {
    for (let i = 0; i < 5; i++) {
      if (state.photos[i]) {
        removePhoto(i);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MINI MAPA Y GEOLOCALIZACIÓN */
/* ═══════════════════════════════════════════════════════════════════════════ */
let miniMap = null, miniMarker = null;

function initMiniMap(lat, lng) {
  const el = document.getElementById('miniMap');
  const geoWrap = document.getElementById('geoWrap');
  if (el) el.classList.add('visible');
  if (geoWrap) geoWrap.style.display = 'block';
  const mapHint = document.getElementById('mapHint');
  if (mapHint) mapHint.style.display = 'block';

  if (!miniMap) {
    miniMap = L.map('miniMap', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19
    }).addTo(miniMap);
    miniMarker = L.marker([lat, lng], { draggable: true }).addTo(miniMap);
    miniMarker.on('dragend', e => {
      const pos = e.target.getLatLng();
      state.lat = pos.lat; state.lng = pos.lng;
      const latInput = document.getElementById('inp-lat');
      const lngInput = document.getElementById('inp-lng');
      if (latInput) latInput.value = pos.lat;
      if (lngInput) lngInput.value = pos.lng;
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

      const dirInput = document.getElementById('inp-dir');
      const ciudadInput = document.getElementById('inp-ciudad');
      const comunaInput = document.getElementById('inp-comuna');
      const locDireccion = document.getElementById('locDireccion');
      const locCiudad = document.getElementById('locCiudad');
      const locComuna = document.getElementById('locComuna');

      if (dirInput) dirInput.value = state.dir;
      if (ciudadInput) ciudadInput.value = state.ciudad;
      if (comunaInput) comunaInput.value = state.comuna;
      if (locDireccion) locDireccion.textContent = state.dir;
      if (locCiudad) locCiudad.textContent = state.ciudad;
      if (locComuna) locComuna.textContent = state.comuna;
    }
  } catch(e) { console.log('Error reverse geocode:', e); }
}

function usarUbicacionActual() {
  const btn = document.getElementById('btnGpsLoc');
  if (!navigator.geolocation) { alert('Tu navegador no soporta GPS.'); return; }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Obteniendo ubicación...';
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      state.lat = lat; state.lng = lng;
      const latInput = document.getElementById('inp-lat');
      const lngInput = document.getElementById('inp-lng');
      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;

      await reverseGeocode(lat, lng);

      const locationCard = document.getElementById('locationInfoCard');
      const ubicacionErr = document.getElementById('ubicacionErr');
      const geoWrap = document.getElementById('geoWrap');

      if (locationCard) locationCard.style.display = 'block';
      if (ubicacionErr) ubicacionErr.style.display = 'none';
      initMiniMap(lat, lng);
      if (geoWrap) geoWrap.className = 'geo-wrap ok';
      updatePreview();

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✅ ¡Ubicación obtenida! (Podés ajustar el pin)';
      }
      const ubicacionField = document.getElementById('f-ubicacion');
      if (ubicacionField) setErr('f-ubicacion', false);
    },
    err => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📍 Obtener mi ubicación actual';
      }
      let msg = 'No se pudo obtener la ubicación.';
      if (err.code === 1) msg = 'Permiso denegado.';
      if (err.code === 2) msg = 'Ubicación no disponible.';
      if (err.code === 3) msg = 'Tiempo agotado.';
      const ubicacionErr = document.getElementById('ubicacionErr');
      if (ubicacionErr) {
        ubicacionErr.textContent = msg;
        ubicacionErr.style.display = 'block';
      }
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
  const successScreen = document.getElementById('successScreen');
  if (successScreen) successScreen.classList.remove('active');
  const stepDiv = document.getElementById('step' + n);
  if (stepDiv) stepDiv.classList.add('active');
  const progressBar = document.getElementById('progressBar');
  if (progressBar) progressBar.style.width = (n / TOTAL_STEPS * 100) + '%';

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.getElementById('si' + i);
    if (dot) dot.className = 'si-dot' + (i < n ? ' done' : i === n ? ' active' : '');
    const sl = document.getElementById('sl' + i);
    if (sl) sl.className = 'si-line' + (i < n ? ' done' : '');
  }
  const rightPanel = document.querySelector('.right-panel');
  if (rightPanel) rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
  if (n === 1 && miniMap) setTimeout(() => miniMap.invalidateSize(), 250);
}

function validateStep(step) {
  if (step === 1) {
    const nombreInput = document.getElementById('inp-nombre');
    const nombre = nombreInput ? nombreInput.value.trim() : '';
    state.nombre = nombre;
    const diasOk = state.dias.length > 0;
    const ubicacionOk = state.lat !== null;

    setErr('f-nombre', !nombre);
    setErr('f-dias', !diasOk);
    setErr('f-ubicacion', !ubicacionOk);
    if (!ubicacionOk) {
      const ubicacionErr = document.getElementById('ubicacionErr');
      if (ubicacionErr) ubicacionErr.style.display = 'block';
    }

    const catErrMsg = document.querySelector('#f-cat .err-msg');
    if (catErrMsg) {
      if (!state.cat) catErrMsg.style.display = 'block';
      else catErrMsg.style.display = 'none';
    }

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
    const wspInput = document.getElementById('inp-wsp');
    const wsp = wspInput ? wspInput.value.trim() : '';
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
  const catErrMsg = document.querySelector('#f-cat .err-msg');
  if (catErrMsg) catErrMsg.style.display = 'none';
  updatePreview();
}

function toggleDay(btn, day) {
  btn.classList.toggle('on');
  const idx = state.dias.indexOf(day);
  if (idx > -1) state.dias.splice(idx, 1); else state.dias.push(day);
  const order = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  state.dias.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const daysDisplay = document.getElementById('daysDisplay');
  if (daysDisplay) daysDisplay.textContent = state.dias.length ? state.dias.join(', ') : 'ninguno';
  updatePreview();
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* UPDATE PREVIEW */
/* ═══════════════════════════════════════════════════════════════════════════ */
function updatePreview() {
  const domicilioSelect = document.getElementById('inp-domicilio');
  if (domicilioSelect) state.domicilio = domicilioSelect.value;

  const nombreInput = document.getElementById('inp-nombre');
  const nombre = nombreInput ? nombreInput.value : 'Nombre de tu negocio';
  const desdeInput = document.getElementById('inp-desde');
  const desde = desdeInput ? desdeInput.value : '08:00';
  const hastaInput = document.getElementById('inp-hasta');
  const hasta = hastaInput ? hastaInput.value : '18:00';
  const igInput = document.getElementById('inp-ig');
  const ig = igInput ? igInput.value : '';
  const fbInput = document.getElementById('inp-fb');
  const fb = fbInput ? fbInput.value : '';
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
  const fotosCount = state.photos.filter(p => p && p.dataUrl).length;
  const wspInput = document.getElementById('inp-wsp');
  const contactoOk = !!(wspInput && wspInput.value.trim());

  const checkInfo = document.getElementById('checkInfo');
  const checkUbicacion = document.getElementById('checkUbicacion');
  const checkFotos = document.getElementById('checkFotos');
  const checkContacto = document.getElementById('checkContacto');
  const fotosCountSpan = document.getElementById('fotosCount');

  if (checkInfo) checkInfo.classList.toggle('done', nombreOk && catOk);
  if (checkUbicacion) checkUbicacion.classList.toggle('done', ubicacionOk);
  if (checkFotos) checkFotos.classList.toggle('done', fotosCount >= 1);
  if (checkContacto) checkContacto.classList.toggle('done', contactoOk);
  if (fotosCountSpan) fotosCountSpan.textContent = fotosCount;

  const pceHeader = document.getElementById('pceHeader');
  const pceCatIco = document.getElementById('pceCatIco');
  const pceCatName = document.getElementById('pceCatName');

  if (pceHeader) pceHeader.style.background = bg;
  if (pceCatIco) pceCatIco.textContent = ico;
  if (pceCatName) pceCatName.textContent = catLabel;

  // Solo usar fotos que ya tienen dataUrl (FileReader terminó)
  const mainPhoto = state.photos.find(p => p && p.dataUrl);
  const photoPlaceholder = document.querySelector('.pce-photo-placeholder');
  const photoImg = document.getElementById('pcePhotoImg');

  if (mainPhoto && photoPlaceholder && photoImg) {
    photoPlaceholder.style.display = 'none';
    photoImg.style.display = 'block';
    photoImg.src = mainPhoto.dataUrl;
  } else if (photoPlaceholder && photoImg) {
    photoPlaceholder.style.display = 'flex';
    photoImg.style.display = 'none';
  }

  const pceName = document.getElementById('pceName');
  const pceDesc = document.getElementById('pceDesc');

  if (pceName) pceName.textContent = nombre;
  if (pceDesc) {
    pceDesc.textContent = desc || 'Agregá una descripción para destacar tu negocio';
    pceDesc.style.opacity = desc ? '1' : '.6';
  }

  const strip = document.getElementById('pcePhotoStrip');
  if (strip) {
    strip.innerHTML = '';
    state.photos.forEach((p, i) => {
      if (p && p.dataUrl) {
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
  }

  const pceDir = document.getElementById('pceDir');
  const pceCiudadComuna = document.getElementById('pceCiudadComuna');
  const pceDias = document.getElementById('pceDias');
  const pceHora = document.getElementById('pceHora');

  if (pceDir) pceDir.textContent = dirText;
  if (pceCiudadComuna) pceCiudadComuna.textContent = ciudadComuna;
  if (pceDias) pceDias.textContent = state.dias.length ? state.dias.join(', ') : 'No especificado';
  if (pceHora) pceHora.textContent = horaText;

  const wsp = wspInput ? wspInput.value : '';
  const wspPubCheck = document.getElementById('chk-wsp-pub');
  const wspPub = wspPubCheck ? wspPubCheck.checked : false;
  const contactoText = wspPub && wsp ? `WhatsApp: ${wsp}` : 'WhatsApp (privado)';
  const pceContacto = document.getElementById('pceContacto');
  if (pceContacto) pceContacto.textContent = contactoText;

  const redes = [];
  if (ig) redes.push('IG');
  if (fb) redes.push('FB');
  if (state.domicilio !== 'no') redes.push(domicilioTexto);
  const pceRedes = document.getElementById('pceRedes');
  if (pceRedes) pceRedes.textContent = redes.length ? redes.join(' · ') : 'Sin redes sociales';

  const socialDiv = document.getElementById('pceSocialLinks');
  if (socialDiv) {
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
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SUBMIT */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function submitForm() {
  const termsCheck = document.getElementById('chk-terms');
  if (!termsCheck || !termsCheck.checked) {
    showToast('Aceptá los términos para continuar 👆');
    return;
  }

  const photoCount = state.photos.filter(p => p && p.file).length;
  if (photoCount === 0) {
    showToast('📸 Subí al menos 1 foto de tu negocio');
    goStep(2);
    return;
  }

  const errorBanner = document.getElementById('errorBanner');
  if (errorBanner) errorBanner.classList.remove('show');
  const btn = document.getElementById('submitBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';
  }

  const desdeInput = document.getElementById('inp-desde');
  const desde = desdeInput ? desdeInput.value : '08:00';
  const hastaInput = document.getElementById('inp-hasta');
  const hasta = hastaInput ? hastaInput.value : '18:00';
  const diasStr = state.dias.length ? state.dias.join(', ') : 'No especificado';
  const diasAtencion = diasStr + ' · ' + desde + '–' + hasta;

  const nombreInput = document.getElementById('inp-nombre');
  const wspInput = document.getElementById('inp-wsp');
  const wspPubCheck = document.getElementById('chk-wsp-pub');
  const igInput = document.getElementById('inp-ig');
  const fbInput = document.getElementById('inp-fb');
  const csrfToken = document.querySelector('meta[name="csrf-token"]');

  const formData = new FormData();
  formData.append('csrfmiddlewaretoken', csrfToken ? csrfToken.content : '');
  formData.append('nombre', nombreInput ? nombreInput.value.trim() : '');
  formData.append('tipo', state.cat || 'emprendimiento');
  formData.append('descripcion', state.descripcion);
  formData.append('direccion', state.dir || '');
  formData.append('ciudad', state.ciudad || '');
  formData.append('comuna', state.comuna || '');
  formData.append('dias_atencion', diasAtencion);
  formData.append('whatsapp', wspInput ? wspInput.value.trim() : '');
  formData.append('wsp_publico', (wspPubCheck && wspPubCheck.checked) ? 'si' : 'no');
  formData.append('instagram', igInput ? igInput.value.trim() : '');
  formData.append('facebook', fbInput ? fbInput.value.trim() : '');
  formData.append('latitud', state.lat ?? '');
  formData.append('longitud', state.lng ?? '');
  formData.append('domicilio', state.domicilio);

  // Enviar todas las fotos válidas
  const validPhotos = state.photos.filter(p => p && p.file);
  console.log(`📸 Enviando ${validPhotos.length} fotos al servidor`);
  validPhotos.forEach((photo) => {
    formData.append('imagenes', photo.file);
  });
  formData.append('total_fotos', validPhotos.length);

  try {
    const res = await fetch(window.location.href, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const step4 = document.getElementById('step' + TOTAL_STEPS);
      if (step4) step4.classList.remove('active');
      const progressBar = document.getElementById('progressBar');
      if (progressBar) progressBar.style.width = '100%';
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        const dot = document.getElementById('si' + i);
        if (dot) dot.className = 'si-dot done';
        const sl = document.getElementById('sl' + i);
        if (sl) sl.className = 'si-line done';
      }
      const successScreen = document.getElementById('successScreen');
      if (successScreen) successScreen.classList.add('active');
      const rightPanel = document.querySelector('.right-panel');
      if (rightPanel) rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const errorText = await res.text();
      console.error('Error del servidor:', errorText);
      const errorMsg = document.getElementById('errorMsg');
      if (errorMsg) errorMsg.textContent = 'Error del servidor (' + res.status + '). Revisá la consola.';
      if (errorBanner) errorBanner.classList.add('show');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀</span> Publicar mi negocio gratis <span class="btn-arrow">→</span>';
      }
    }
  } catch (e) {
    console.error('Error de conexión:', e);
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) errorMsg.textContent = 'Sin conexión. Revisá tu internet.';
    if (errorBanner) errorBanner.classList.add('show');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀</span> Publicar mi negocio gratis <span class="btn-arrow">→</span>';
    }
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

  // Foto slots - abrir selector al hacer click en slot vacío
  document.querySelectorAll('.photo-slot').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.target.classList.contains('remove-photo')) return;
      const currentCount = state.photos.filter(p => p).length;
      if (currentCount >= 5) {
        showToast('📸 Ya tienes 5 fotos. Eliminá algunas para agregar más.');
        return;
      }
      triggerPhotoUpload();
    });
  });

  // Botones de eliminar foto
  document.querySelectorAll('.remove-photo').forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const index = parseInt(this.dataset.index);
      removePhoto(index);
    });
  });

  // Botón limpiar todas las fotos (si existe)
  const clearAllBtn = document.getElementById('clearAllPhotosBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllPhotos);
  }

  // Input events
  const inpNombre    = document.getElementById('inp-nombre');
  const inpDesde     = document.getElementById('inp-desde');
  const inpHasta     = document.getElementById('inp-hasta');
  const inpDomicilio = document.getElementById('inp-domicilio');
  const inpDesc      = document.getElementById('inp-desc');
  const inpWsp       = document.getElementById('inp-wsp');
  const inpIg        = document.getElementById('inp-ig');
  const inpFb        = document.getElementById('inp-fb');
  const chkWspPub    = document.getElementById('chk-wsp-pub');

  if (inpNombre)    inpNombre.addEventListener('input', updatePreview);
  if (inpDesde)     inpDesde.addEventListener('input', updatePreview);
  if (inpHasta)     inpHasta.addEventListener('input', updatePreview);
  if (inpDomicilio) inpDomicilio.addEventListener('change', updatePreview);
  if (inpDesc) inpDesc.addEventListener('input', () => {
    state.descripcion = inpDesc.value;
    const descCount = document.getElementById('descCount');
    if (descCount) descCount.textContent = `${inpDesc.value.length}/500`;
    updatePreview();
  });
  if (inpWsp)    inpWsp.addEventListener('input', updatePreview);
  if (inpIg)     inpIg.addEventListener('input', updatePreview);
  if (inpFb)     inpFb.addEventListener('input', updatePreview);
  if (chkWspPub) chkWspPub.addEventListener('change', updatePreview);

  // Botones de navegación
  const btnGpsLoc       = document.getElementById('btnGpsLoc');
  const btnStep2        = document.getElementById('btnStep2');
  const btnBackTo1      = document.getElementById('btnBackTo1');
  const photoContinueBtn= document.getElementById('photoContinueBtn');
  const btnBackTo2      = document.getElementById('btnBackTo2');
  const btnStep4        = document.getElementById('btnStep4');
  const btnBackTo3      = document.getElementById('btnBackTo3');
  const submitBtn       = document.getElementById('submitBtn');
  const verMapaBtn      = document.getElementById('verMapaBtn');

  if (btnGpsLoc)        btnGpsLoc.addEventListener('click', usarUbicacionActual);
  if (btnStep2)         btnStep2.addEventListener('click', () => goStep(2));
  if (btnBackTo1)       btnBackTo1.addEventListener('click', () => goStep(1));
  if (photoContinueBtn) photoContinueBtn.addEventListener('click', () => goStep(3));
  if (btnBackTo2)       btnBackTo2.addEventListener('click', () => goStep(2));
  if (btnStep4)         btnStep4.addEventListener('click', () => goStep(4));
  if (btnBackTo3)       btnBackTo3.addEventListener('click', () => goStep(3));
  if (submitBtn)        submitBtn.addEventListener('click', submitForm);

  // Botones de edición en preview
  const editPhotosBtn   = document.getElementById('editPhotosBtn');
  const editInfoBtn     = document.getElementById('editInfoBtn');
  const editUbicacionBtn= document.getElementById('editUbicacionBtn');
  const editHorarioBtn  = document.getElementById('editHorarioBtn');
  const editContactoBtn = document.getElementById('editContactoBtn');
  const qaEditInfo      = document.getElementById('qaEditInfo');
  const qaEditPhotos    = document.getElementById('qaEditPhotos');
  const qaEditContacto  = document.getElementById('qaEditContacto');

  if (editPhotosBtn)    editPhotosBtn.addEventListener('click', () => goStep(2));
  if (editInfoBtn)      editInfoBtn.addEventListener('click', () => goStep(1));
  if (editUbicacionBtn) editUbicacionBtn.addEventListener('click', () => goStep(1));
  if (editHorarioBtn)   editHorarioBtn.addEventListener('click', () => goStep(1));
  if (editContactoBtn)  editContactoBtn.addEventListener('click', () => goStep(3));
  if (qaEditInfo)       qaEditInfo.addEventListener('click', () => goStep(1));
  if (qaEditPhotos)     qaEditPhotos.addEventListener('click', () => goStep(2));
  if (qaEditContacto)   qaEditContacto.addEventListener('click', () => goStep(3));

  // Ver mapa
  if (verMapaBtn) {
    verMapaBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  // Inicializar contadores
  updatePhotoCounter();
  const inpDescElement = document.getElementById('inp-desc');
  if (inpDescElement) {
    const descCount = document.getElementById('descCount');
    if (descCount) descCount.textContent = `${inpDescElement.value.length}/500`;
  }
});