// ============================================================
//  BackToNotes - tweaks.js
//  Tweakable controls panel. Vanilla JS, no React dependency.
//  Speaks the host's editor protocol so the toolbar toggle works,
//  and exposes window.btnOpenTweaks() so the app can open it too.
// ============================================================

(function () {
  'use strict';

  const KEYS = ['palette', 'ritmo', 'voz'];
  const STORAGE_KEY = 'backtonotes:tweaks:v1';
  const DENSITY_KEY = 'backtonotes:card-density:v1';

  const OPTIONS = {
    palette: [
      { id: 'caderno', label: 'Caderno',
        sub: 'creme + acento único (padrão)',
        swatch: ['#dc4a2c', '#f4ede0', '#18120a', '#6d574a'] },
      { id: 'lousa',   label: 'Lousa',
        sub: 'noite · sala de leitura',
        swatch: ['#c79a51', '#1a1f1c', '#dfa852', '#8aab73'] },
      { id: 'bosque',  label: 'Bosque',
        sub: 'biblioteca clássica',
        swatch: ['#3d5a47', '#eee9df', '#b8843d', '#6b1f2a'] },
      { id: 'linho',   label: 'Linho & Tinta',
        sub: 'preto sobre linho · ocre único',
        swatch: ['#14110d', '#efebe2', '#b8742f', '#763425'] },
      { id: 'cobalto', label: 'Cobalto',
        sub: 'azul + vermelho-laca',
        swatch: ['#2a4878', '#ebe6d4', '#c08820', '#c44a2f'] },
    ],
    ritmo: [
      { id: 'compacto',    label: 'Compacto',    hint: 'cards apertados, 2-up no celular' },
      { id: 'confortavel', label: 'Confortável', hint: 'o atual' },
      { id: 'mural',       label: 'Mural',       hint: 'cards grandes, respiração' },
    ],
    voz: [
      { id: 'editorial', label: 'Editorial', hint: 'serifa Fraunces nos títulos' },
      { id: 'sobria',    label: 'Sóbria',    hint: 'sans neutro nos títulos' },
    ],
  };

  const defaults = window.__btnTweakDefaults || { palette: 'bosque', ritmo: 'confortavel', voz: 'editorial' };
  function storedTweaks() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
  }
  let current = { ...defaults, ...storedTweaks() };
  try {
    const savedDensity = localStorage.getItem(DENSITY_KEY);
    if (savedDensity) current.ritmo = savedDensity;
  } catch {}
  let panelOpen = false;

  function applyAll() {
    for (const k of KEYS) {
      if (current[k]) document.documentElement.setAttribute('data-' + k, current[k]);
    }
  }

  // Update a single tweak — apply locally, persist via the host bridge.
  function setTweak(key, value) {
    if (current[key] === value) return;
    current[key] = value;
    applyAll();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      if (key === 'ritmo') localStorage.setItem(DENSITY_KEY, value);
    } catch {}
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
    } catch {}
    if (panelOpen) renderPanel();
  }

  function openPanel() {
    if (panelOpen) return;
    panelOpen = true;
    renderPanel();
    setTimeout(() => document.querySelector('.tweaks-panel')?.focus(), 60);
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    const root = document.getElementById('tweaks-root');
    if (root) root.innerHTML = '';
    try {
      window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
    } catch {}
  }

  function togglePanel() { panelOpen ? closePanel() : openPanel(); }

  function htmlSafe(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function renderPanel() {
    const root = document.getElementById('tweaks-root');
    if (!root) return;

    const currentPaletteOption = OPTIONS.palette.find((o) => o.id === current.palette);
    const currentRitmoOption   = OPTIONS.ritmo.find((o) => o.id === current.ritmo);
    const currentVozOption     = OPTIONS.voz.find((o) => o.id === current.voz);

    root.innerHTML = `
      <div class="tweaks-backdrop" data-tweaks-close></div>
      <aside class="tweaks-panel" role="dialog" aria-label="Tweaks" tabindex="-1">
        <header class="tweaks-head">
          <h2>Tweaks</h2>
          <button class="tweaks-close" aria-label="Fechar" data-tweaks-close>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>

        <div class="tweaks-body">
          <section class="tweaks-section">
            <div class="tweaks-section-head">
              <span class="tweaks-label">Paleta</span>
              <span class="tweaks-current">${htmlSafe(currentPaletteOption?.sub || '')}</span>
            </div>
            <div class="tweaks-grid grid-2col">
              ${OPTIONS.palette.map((o) => `
                <button class="tweaks-palette-card ${current.palette === o.id ? 'active' : ''}"
                        data-key="palette" data-value="${o.id}" aria-pressed="${current.palette === o.id}">
                  <span class="tweaks-swatches">
                    ${o.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}
                  </span>
                  <span class="tweaks-palette-label">${htmlSafe(o.label)}</span>
                </button>
              `).join('')}
            </div>
          </section>

          <section class="tweaks-section">
            <div class="tweaks-section-head">
              <span class="tweaks-label">Ritmo</span>
              <span class="tweaks-hint">${htmlSafe(currentRitmoOption?.hint || '')}</span>
            </div>
            <div class="tweaks-segmented" role="group" aria-label="Ritmo">
              ${OPTIONS.ritmo.map((o) => `
                <button class="${current.ritmo === o.id ? 'active' : ''}"
                        data-key="ritmo" data-value="${o.id}" aria-pressed="${current.ritmo === o.id}">
                  ${htmlSafe(o.label)}
                </button>
              `).join('')}
            </div>
          </section>

          <section class="tweaks-section">
            <div class="tweaks-section-head">
              <span class="tweaks-label">Voz tipográfica</span>
              <span class="tweaks-hint">${htmlSafe(currentVozOption?.hint || '')}</span>
            </div>
            <div class="tweaks-segmented" role="group" aria-label="Voz">
              ${OPTIONS.voz.map((o) => `
                <button class="${current.voz === o.id ? 'active' : ''}"
                        data-key="voz" data-value="${o.id}" aria-pressed="${current.voz === o.id}">
                  ${htmlSafe(o.label)}
                </button>
              `).join('')}
            </div>
          </section>
        </div>

        <footer class="tweaks-foot">
          <small>Cada escolha refaz o tom — paleta, densidade ou voz. As mudanças são persistidas localmente.</small>
        </footer>
      </aside>
    `;

    // Wire up interactions
    root.querySelectorAll('[data-key]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setTweak(btn.dataset.key, btn.dataset.value);
      });
    });
    root.querySelectorAll('[data-tweaks-close]').forEach((el) => {
      el.addEventListener('click', closePanel);
    });
  }

  // ESC closes
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) {
      e.preventDefault();
      closePanel();
    }
  });

  // CRITICAL: register the host listener BEFORE announcing availability.
  // If we post __edit_mode_available first, the host's activate message
  // can land before our handler exists and the toolbar toggle silently
  // does nothing.
  window.addEventListener('message', (e) => {
    const t = e.data?.type;
    if (t === '__activate_edit_mode') openPanel();
    else if (t === '__deactivate_edit_mode') closePanel();
  });

  // Expose API for the in-app sidebar button.
  window.btnOpenTweaks = openPanel;
  window.btnToggleTweaks = togglePanel;

  // Apply defaults and announce.
  applyAll();
  try {
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  } catch {}
})();
