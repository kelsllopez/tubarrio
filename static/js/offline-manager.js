/* ═══════════════════════════════════════════════════════════
   offline-manager.js — TuBarrio
   Manejo de estado Offline/Online + Caché de Negocios
   ✅ CORREGIDO: Botón X 100% funcional
═══════════════════════════════════════════════════════════ */

const OFFLINE_STORAGE_KEY = 'tubarrio_offline_negocios';
const OFFLINE_LAST_UPDATE_KEY = 'tubarrio_offline_last_update';
const MAX_CACHED_NEGOCIOS = 50;

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.cachedNegocios = [];
    this.bannerElement = null;
    this.autoHideTimer = null;
    
    this.init();
  }

  init() {
    // Cargar datos cacheados al iniciar
    this.loadCachedData();
    
    // Configurar listeners de conexión
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Crear banner offline (esperar a que el DOM esté listo)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createOfflineBanner());
    } else {
      this.createOfflineBanner();
    }
    
    // Estado inicial
    if (!this.isOnline) {
      setTimeout(() => {
        this.showOfflineBanner();
        this.loadCachedDataIntoApp();
      }, 100);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CACHÉ DE NEGOCIOS
  // ═══════════════════════════════════════════════════════════

  saveNegociosToCache(negocios) {
    try {
      if (!negocios || !Array.isArray(negocios)) return;
      
      const toCache = negocios.slice(0, MAX_CACHED_NEGOCIOS);
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(toCache));
      localStorage.setItem(OFFLINE_LAST_UPDATE_KEY, new Date().toISOString());
      this.cachedNegocios = toCache;
      
      console.log(`📦 ${toCache.length} negocios guardados para modo offline`);
    } catch (e) {
      console.error('Error guardando caché offline:', e);
    }
  }

  loadCachedData() {
    try {
      const cached = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (cached) {
        this.cachedNegocios = JSON.parse(cached);
        const lastUpdate = localStorage.getItem(OFFLINE_LAST_UPDATE_KEY);
        
        console.log(`📦 ${this.cachedNegocios.length} negocios cargados desde caché`);
        if (lastUpdate) {
          const date = new Date(lastUpdate);
          console.log(`   Última actualización: ${date.toLocaleDateString('es-CL')} ${date.toLocaleTimeString('es-CL')}`);
        }
      }
    } catch (e) {
      console.error('Error cargando caché offline:', e);
      this.cachedNegocios = [];
    }
  }

  getCachedNegocios() {
    return this.cachedNegocios;
  }

  hasCachedData() {
    return this.cachedNegocios.length > 0;
  }

  getLastUpdateText() {
    const lastUpdate = localStorage.getItem(OFFLINE_LAST_UPDATE_KEY);
    if (!lastUpdate) return null;
    
    const date = new Date(lastUpdate);
    const ahora = new Date();
    const diffMs = ahora - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHoras < 24) return `hace ${diffHoras} h`;
    return `hace ${diffDias} días`;
  }

  // ═══════════════════════════════════════════════════════════
  // BANNER OFFLINE
  // ═══════════════════════════════════════════════════════════

  createOfflineBanner() {
    // Remover banner existente si hay
    const existing = document.getElementById('offlineBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: #FEF3C7;
      color: #92400E;
      padding: 0.7rem 1rem;
      text-align: center;
      font-size: 0.85rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border-bottom: 1px solid #FDE68A;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    const icon = document.createElement('span');
    icon.textContent = '📡';
    icon.style.fontSize = '1rem';
    
    const text = document.createElement('span');
    text.id = 'offlineBannerText';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'offlineBannerCloseBtn';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Cerrar banner');
    closeBtn.style.cssText = `
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      color: #92400E;
      opacity: 0.7;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      transition: opacity 0.2s, background 0.2s;
      line-height: 1;
    `;
    closeBtn.onmouseover = () => { 
      closeBtn.style.opacity = '1'; 
      closeBtn.style.background = 'rgba(0,0,0,0.05)'; 
    };
    closeBtn.onmouseout = () => { 
      closeBtn.style.opacity = '0.7'; 
      closeBtn.style.background = 'none'; 
    };
    
    banner.appendChild(icon);
    banner.appendChild(text);
    banner.appendChild(closeBtn);
    
    document.body.appendChild(banner);
    this.bannerElement = banner;
    
    // ✅ USAR addEventListener (FORMA MÁS CONFIABLE)
    const self = this;
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔥 Botón X clickeado - cerrando banner');
      self.hideOfflineBanner();
    });
    
    this.updateBannerText();
  }

  updateBannerText() {
    const textEl = document.getElementById('offlineBannerText');
    if (!textEl) return;
    
    if (!this.isOnline) {
      const lastUpdate = this.getLastUpdateText();
      const cachedCount = this.cachedNegocios.length;
      
      if (cachedCount > 0) {
        textEl.innerHTML = `📡 Sin conexión · Mostrando <strong>${cachedCount} negocios</strong> guardados${lastUpdate ? ` (${lastUpdate})` : ''}`;
      } else {
        textEl.innerHTML = `📡 Sin conexión a internet · No hay datos guardados`;
      }
    } else {
      textEl.innerHTML = `✅ Conexión restablecida · Datos actualizados`;
    }
  }

  showOfflineBanner() {
    // Cancelar timer de auto-ocultar si existe
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    
    const banner = document.getElementById('offlineBanner');
    if (banner) {
      banner.style.transform = 'translateY(0)';
      console.log('📢 Banner mostrado');
    }
  }

  hideOfflineBanner() {
    console.log('🔥 hideOfflineBanner ejecutado');
    
    // Cancelar timer de auto-ocultar
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    
    const banner = document.getElementById('offlineBanner');
    if (banner) {
      banner.style.transform = 'translateY(-100%)';
      console.log('✅ Banner ocultado correctamente');
    } else {
      console.log('❌ No se encontró el banner para ocultar');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MANEJADORES DE EVENTOS
  // ═══════════════════════════════════════════════════════════

  handleOnline() {
    console.log('🟢 Conexión restablecida');
    this.isOnline = true;
    
    // Mostrar banner temporal de reconexión
    this.updateBannerText();
    this.showOfflineBanner();
    
    // Programar ocultar después de 3 segundos
    this.autoHideTimer = setTimeout(() => {
      if (this.isOnline) {
        this.hideOfflineBanner();
      }
      this.autoHideTimer = null;
    }, 3000);
    
    // Disparar evento para que la app recargue datos frescos
    window.dispatchEvent(new CustomEvent('tubarrio:online'));
    
    // Actualizar badge de estado en statusBar si existe
    if (typeof window.setStatus === 'function') {
      window.setStatus('✅ Conexión restablecida · Actualizando datos...', 'ok', 2500);
    }
  }

  handleOffline() {
    console.log('🔴 Sin conexión a internet');
    this.isOnline = false;
    
    // Cancelar cualquier timer de auto-ocultar
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    
    this.updateBannerText();
    this.showOfflineBanner();
    
    // Cargar datos cacheados en la app
    this.loadCachedDataIntoApp();
    
    // Disparar evento
    window.dispatchEvent(new CustomEvent('tubarrio:offline'));
    
    // Mostrar mensaje en statusBar
    if (typeof window.setStatus === 'function') {
      const count = this.cachedNegocios.length;
      if (count > 0) {
        window.setStatus(`📡 Modo offline · Mostrando ${count} negocios guardados`, 'warn', 4000);
      } else {
        window.setStatus('📡 Sin conexión · Conéctate para ver negocios', 'warn', 4000);
      }
    }
  }

  loadCachedDataIntoApp() {
    // Si hay datos cacheados y la variable global NEGOCIOS existe
    if (this.hasCachedData() && typeof window.NEGOCIOS !== 'undefined') {
      // Solo reemplazar si no hay datos actuales
      if (!window.NEGOCIOS || window.NEGOCIOS.length === 0) {
        window.NEGOCIOS = [...this.cachedNegocios];
        
        // Actualizar knownIds
        if (typeof window.knownIds !== 'undefined') {
          window.knownIds = new Set(window.NEGOCIOS.map(n => n.id));
        }
        
        // Re-renderizar si la función existe
        if (typeof window.renderAll === 'function') {
          window.renderAll();
        }
        
        // Actualizar badge
        if (typeof window.updateBadge === 'function') {
          window.updateBadge();
        }
        
        console.log(`📦 Datos offline cargados: ${this.cachedNegocios.length} negocios`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════

let offlineManager;

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    offlineManager = new OfflineManager();
    window.offlineManager = offlineManager;
  });
} else {
  offlineManager = new OfflineManager();
  window.offlineManager = offlineManager;
}

// Función helper para guardar negocios en caché
function cacheNegociosForOffline(negocios) {
  if (offlineManager) {
    offlineManager.saveNegociosToCache(negocios);
  }
}

// Exponer función global
window.cacheNegociosForOffline = cacheNegociosForOffline;