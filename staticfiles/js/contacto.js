/* ══════════════════════════════════════
   contacto.js — TuBarrio
   Validaciones + Toast + Submit AJAX
══════════════════════════════════════ */

const form      = document.getElementById('contactForm');
const btnSubmit = document.getElementById('btnSubmit');
const toast     = document.getElementById('statusToast');
let toastTimer  = null;

/* ── Validación en tiempo real (mientras escribe) ── */
form.querySelectorAll('input, textarea, select').forEach(el => {
  el.addEventListener('input', () => validateField(el));
  el.addEventListener('blur',  () => validateField(el));
});

function validateField(el) {
  if (!el.hasAttribute('required') && el.value === '') return; // opcional vacío = neutro
  if (el.checkValidity()) {
    el.classList.remove('is-invalid');
    el.classList.add('is-valid');
  } else {
    el.classList.remove('is-valid');
    el.classList.add('is-invalid');
  }
}

/* ── Submit ── */
form.addEventListener('submit', async function(e) {
  e.preventDefault();

  // Validar todos los campos requeridos
  let valido = true;
  form.querySelectorAll('input[required], textarea[required]').forEach(el => {
    validateField(el);
    if (!el.checkValidity()) valido = false;
  });

  if (!valido) {
    const primerError = form.querySelector('.is-invalid');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    mostrarToast('error', '⚠️', 'Revisa el formulario', 'Hay campos obligatorios incompletos o incorrectos.');
    return;
  }

  // Estado enviando
  btnSubmit.classList.add('sending');
  btnSubmit.querySelector('.arrow').style.display = 'none';
  const textoOriginal = btnSubmit.childNodes[0].textContent;
  btnSubmit.childNodes[0].textContent = 'Enviando…  ';

  try {
    const resp = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (resp.ok) {
      mostrarToast('success', '✅', '¡Mensaje enviado!', 'Recibimos tu consulta. Te responderemos en menos de 24h.');
      form.reset();
      form.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
        el.classList.remove('is-valid', 'is-invalid');
      });
      document.getElementById('successMsg').style.display = 'block';
      form.style.display = 'none';
    } else {
      throw new Error('Server error ' + resp.status);
    }
  } catch (err) {
    mostrarToast('error', '❌', 'Error al enviar', 'Hubo un problema al enviar tu mensaje. Intenta de nuevo o escríbenos directamente a soporte@tubarrio.cl');
  } finally {
    btnSubmit.classList.remove('sending');
    btnSubmit.querySelector('.arrow').style.display = '';
    btnSubmit.childNodes[0].textContent = textoOriginal;
  }
});

/* ── Toast helper ── */
function mostrarToast(tipo, icono, titulo, texto) {
  document.getElementById('toastIcon').textContent  = icono;
  document.getElementById('toastTitle').textContent = titulo;
  document.getElementById('toastText').textContent  = texto;
  toast.className = 'status-toast toast-' + tipo + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(cerrarToast, tipo === 'success' ? 6000 : 8000);
}

function cerrarToast() {
  toast.classList.remove('show');
}