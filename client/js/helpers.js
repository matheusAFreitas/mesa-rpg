// ---- HELPERS GLOBAIS ----

/** Gera um ID único baseado em timestamp + random. */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Retorna o valor de um input pelo id, ou null se não existir. */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : null;
}

/** Escapa caracteres especiais HTML para evitar XSS. */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Retorna uma função que só executa `fn` após `ms` milissegundos de inatividade. */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Converte string "NOME:VALOR, ..." para objeto de atributos. */
function parseStats(s) {
  if (!s) return {};
  const out = {};
  s.split(',').forEach(p => {
    const [k, v] = (p || '').trim().split(':');
    if (k && v) out[k.trim().toUpperCase()] = v.trim();
  });
  return out;
}

/**
 * Dialog — substitui confirm() e prompt() nativos por modais customizados.
 * Dialog.confirm(msg, onConfirm)
 * Dialog.prompt(msg, defaultVal, onConfirm, { type, placeholder })
 */
const Dialog = {
  _el: null,

  _init() {
    if (this._el) return;
    const el = document.createElement('div');
    el.id = 'dialog-overlay';
    el.innerHTML = `
      <div id="dialog-box">
        <p id="dialog-msg"></p>
        <div id="dialog-input-wrap">
          <input id="dialog-input" class="fc">
        </div>
        <div id="dialog-btns">
          <button class="btn btn-secondary" id="dialog-cancel">Cancelar</button>
          <button class="btn btn-primary"   id="dialog-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._el = el;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter')  document.getElementById('dialog-ok').click();
      if (e.key === 'Escape') document.getElementById('dialog-cancel').click();
    });
  },

  confirm(msg, onConfirm) {
    this._init();
    document.getElementById('dialog-msg').innerHTML = msg;
    document.getElementById('dialog-input-wrap').style.display = 'none';
    document.getElementById('dialog-ok').textContent = 'Confirmar';
    this._el.classList.add('open');
    const ok     = document.getElementById('dialog-ok');
    const cancel = document.getElementById('dialog-cancel');
    ok.onclick     = () => { this._el.classList.remove('open'); onConfirm(); };
    cancel.onclick = () => { this._el.classList.remove('open'); };
    setTimeout(() => ok.focus(), 50);
  },

  prompt(msg, defaultVal, onConfirm, opts = {}) {
    this._init();
    document.getElementById('dialog-msg').innerHTML = msg;
    const wrap  = document.getElementById('dialog-input-wrap');
    const input = document.getElementById('dialog-input');
    wrap.style.display  = 'block';
    input.type          = opts.type || 'text';
    input.placeholder   = opts.placeholder || '';
    input.value         = defaultVal != null ? defaultVal : '';
    document.getElementById('dialog-ok').textContent = 'OK';
    this._el.classList.add('open');
    const ok     = document.getElementById('dialog-ok');
    const cancel = document.getElementById('dialog-cancel');
    ok.onclick     = () => { this._el.classList.remove('open'); onConfirm(input.value); };
    cancel.onclick = () => { this._el.classList.remove('open'); };
    setTimeout(() => input.focus(), 50);
  }
};

/** Converte cor hex para rgba(r,g,b,alpha). */
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
