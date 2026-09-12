// Estado del wizard + lógica de negocio pura (sin DOM).

const STORAGE_KEY = 'planbase_state_v1';

export function defaultState() {
  return {
    step: 'goal',
    goal: null,
    salesText: null,
    salesFileName: null,
    stockText: null,
    stockFileName: null,
    manualRows: [],
    leadTime: { answer: null, value: null, unit: null }, // 'dias'|'semanas'|'meses'|'depende'|'no_se'
    safetyStock: { answer: null, days: null }, // 'si'|'no'|'no_se'
    promo: { answer: null, detail: null }, // 'si'|'no'|'no_se'
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* localStorage no disponible */ }
}

export function resetState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export const GOALS = [
  { key: 'quiebre', label: 'Evitar quedarme sin stock' },
  { key: 'comprar', label: 'Comprar mejor' },
  { key: 'saber_venta', label: 'Saber cuánto venderé' },
  { key: 'sobrestock', label: 'Reducir exceso de inventario' },
  { key: 'ordenar', label: 'Ordenar mi proceso de planificación' },
  { key: 'todo', label: 'Todo lo anterior' },
];

export function leadTimeToDays(leadTime) {
  if (!leadTime || leadTime.value == null || leadTime.value === '') return null;
  const mult = { dias: 1, semanas: 7, meses: 30 }[leadTime.unit];
  if (!mult) return null;
  const v = parseFloat(leadTime.value);
  return isNaN(v) ? null : Math.round(v * mult);
}

export function deriveContext(state) {
  return {
    leadTimeDays: leadTimeToDays(state.leadTime),
    safetyDays: state.safetyStock.answer === 'si' ? (state.safetyStock.days ?? null) : null,
    promoYes: state.promo.answer === 'si',
    promoUnknown: state.promo.answer === 'no_se',
  };
}

export function explainAvailableData({ hasSales, hasStock }) {
  if (hasSales && hasStock) {
    return 'Con ventas y stock ya podemos estimar demanda, calcular cobertura aproximada y detectar productos con riesgo de quiebre o exceso de inventario.';
  }
  if (hasSales) {
    return 'Con tu histórico de ventas ya podemos estimar demanda, tendencia y variabilidad por producto. Si más adelante sumas tu stock actual, también podremos calcular cobertura y riesgo de quiebre.';
  }
  return 'Todavía no tenemos datos para analizar. Puedes cargar un archivo o escribir algunas ventas manualmente para empezar.';
}
