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

/** Converte cor hex para rgba(r,g,b,alpha). */
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
