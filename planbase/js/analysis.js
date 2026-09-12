// Motor de análisis por SKU: agregación semanal, clasificación, forecast,
// backtesting (accuracy/bias), cobertura de stock, riesgo y confianza.
// Sin dependencias externas — pensado para correr 100% en el navegador.

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function isoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // lunes=1 ... domingo=7
  if (day !== 1) d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function addWeeks(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export function groupBySku(salesRows) {
  const bySku = new Map();
  for (const r of salesRows) {
    if (!bySku.has(r.sku)) bySku.set(r.sku, new Map());
    const weekMap = bySku.get(r.sku);
    const wk = isoWeekStart(r.date);
    weekMap.set(wk, (weekMap.get(wk) || 0) + r.qty);
  }
  return bySku;
}

// Rellena semanas sin ventas con 0 entre la primera y la última venta del SKU.
function toWeeklySeries(weekMap) {
  const weeks = [...weekMap.keys()].sort();
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const series = [];
  let cur = first;
  while (cur <= last) {
    series.push({ week: cur, qty: weekMap.get(cur) || 0 });
    cur = addWeeks(cur, 1);
  }
  return series;
}

function linregSlope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

// Holt (nivel + tendencia). Con muy poca historia se comporta como un
// promedio simple: no exige que el negocio ya tenga un modelo definido.
export function holtForecast(ys, alpha = 0.3, beta = 0.15, periodsAhead = 4) {
  if (ys.length === 0) return { forecast: Array(periodsAhead).fill(0), level: 0, trend: 0 };
  if (ys.length === 1) return { forecast: Array(periodsAhead).fill(ys[0]), level: ys[0], trend: 0 };
  let level = ys[0];
  let trend = ys[1] - ys[0];
  for (let i = 1; i < ys.length; i++) {
    const val = ys[i];
    const prevLevel = level;
    level = alpha * val + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast = [];
  for (let h = 1; h <= periodsAhead; h++) forecast.push(Math.max(0, level + h * trend));
  return { forecast, level, trend };
}

// Backtest: entrena con todo menos las últimas k semanas y compara contra
// lo real. Si no hay historia suficiente, se declara explícitamente en vez
// de inventar un número.
export function backtest(ys) {
  const n = ys.length;
  if (n < 8) return { accuracy: null, bias: null, reason: 'historial_insuficiente' };
  const k = Math.min(4, Math.floor(n / 3));
  const train = ys.slice(0, n - k);
  const actual = ys.slice(n - k);
  const { forecast } = holtForecast(train, 0.3, 0.15, k);
  let apeSum = 0, apeCount = 0, errSum = 0, actualSum = 0;
  for (let i = 0; i < k; i++) {
    const a = actual[i], f = forecast[i];
    actualSum += a;
    // f - a: negativo significa forecast por debajo de lo real (sub-estimación).
    errSum += (f - a);
    if (a !== 0) { apeSum += Math.abs((a - f) / a); apeCount++; }
  }
  const mape = apeCount ? (apeSum / apeCount) * 100 : null;
  const accuracy = mape === null ? null : Math.max(0, Math.round(100 - mape));
  const bias = actualSum !== 0 ? Math.round((errSum / actualSum) * 100) : null;
  return { accuracy, bias };
}

function classify(qtys, lastSaleGapDays) {
  const m = mean(qtys);
  const sd = stdev(qtys);
  const cv = m > 0 ? sd / m : (sd > 0 ? Infinity : 0);
  let variability = 'sin_ventas';
  if (m > 0) variability = cv < 0.5 ? 'estable' : 'irregular';
  const noMovement = lastSaleGapDays !== null && lastSaleGapDays >= 60;
  const slope = linregSlope(qtys);
  let trendLabel = 'plana';
  if (m > 0 && qtys.length >= 4) {
    const relSlope = (slope * qtys.length) / m;
    if (relSlope > 0.15) trendLabel = 'creciente';
    else if (relSlope < -0.15) trendLabel = 'decreciente';
  }
  return { variability, noMovement, trendLabel, cv, mean: m, stdev: sd };
}

function confidenceLevel({ weeks, cv, leadTimeKnown, hasStock, noMovement }) {
  if (noMovement || weeks < 4) return 'Baja';
  // Demanda muy errática: ninguna otra señal alcanza para justificar confianza alta.
  if (!isFinite(cv) || cv >= 1) return 'Baja';
  let score = 0;
  if (weeks >= 12) score++;
  if (cv < 0.5) score++;
  if (leadTimeKnown) score++;
  if (hasStock) score++;
  if (score >= 3) return 'Alta';
  if (score >= 2) return 'Media';
  return 'Baja';
}

function daysOfSupply(stock, avgWeeklyQty) {
  if (stock == null || avgWeeklyQty <= 0) return null;
  return (stock / avgWeeklyQty) * 7;
}

function stockoutRisk(dos, leadTimeDays) {
  if (dos == null) return { level: 'Desconocido', preliminary: false };
  if (leadTimeDays != null) {
    if (dos < leadTimeDays) return { level: 'Alto', preliminary: false };
    if (dos < leadTimeDays * 1.5) return { level: 'Medio', preliminary: false };
    return { level: 'Bajo', preliminary: false };
  }
  if (dos < 7) return { level: 'Alto', preliminary: true };
  if (dos < 21) return { level: 'Medio', preliminary: true };
  return { level: 'Bajo', preliminary: true };
}

function overstockFlag(dos, leadTimeDays, trendLabel) {
  if (dos == null || trendLabel === 'creciente') return false;
  const threshold = leadTimeDays != null ? leadTimeDays * 4 : 90;
  return dos > threshold;
}

function suggestedPurchase({ forecastWeekly, stock, leadTimeDays, safetyDays }) {
  if (stock == null || forecastWeekly == null) return null;
  const targetDays = (leadTimeDays ?? 30) + (safetyDays ?? 0);
  const targetUnits = (targetDays / 7) * forecastWeekly;
  return Math.max(0, Math.round(targetUnits - stock));
}

// Analiza todos los SKU dado el conjunto de ventas (obligatorio), stock
// (opcional) y contexto de negocio recolectado en el onboarding.
export function analyze({ salesRows, stockBySku = {}, context = {} }) {
  const { leadTimeDays = null, safetyDays = null } = context;
  const bySku = groupBySku(salesRows);
  const today = new Date();
  const results = [];

  for (const [sku, weekMap] of bySku.entries()) {
    const series = toWeeklySeries(weekMap);
    const qtys = series.map(s => s.qty);
    const weeks = qtys.length;
    const lastWeekWithSale = [...weekMap.entries()].filter(([, q]) => q > 0).map(([w]) => w).sort().pop();
    const lastSaleGapDays = lastWeekWithSale
      ? Math.round((today.getTime() - new Date(lastWeekWithSale + 'T00:00:00Z').getTime()) / 86400000)
      : null;

    const cls = classify(qtys, lastSaleGapDays);
    // Con historial corto, un modelo con tendencia puede extrapolar ruido:
    // usamos el promedio simple hasta tener suficientes datos para confiar en Holt.
    const forecastWeekly = weeks < 8
      ? Math.round(cls.mean)
      : Math.round(holtForecast(qtys, 0.3, 0.15, 4).forecast[0]);
    const bt = backtest(qtys);

    // Cobertura y compra sugerida deben usar la misma tasa de demanda esperada
    // (el forecast, cuando existe) para no contradecirse entre sí.
    const demandRate = forecastWeekly > 0 ? forecastWeekly : cls.mean;
    const stockInfo = stockBySku[sku] || null;
    const stock = stockInfo ? stockInfo.stock : null;
    const dos = daysOfSupply(stock, demandRate);
    const risk = stockoutRisk(dos, leadTimeDays);
    const overstock = overstockFlag(dos, leadTimeDays, cls.trendLabel);
    const purchase = suggestedPurchase({ forecastWeekly: demandRate, stock, leadTimeDays, safetyDays });

    const confidence = confidenceLevel({
      weeks, cv: cls.cv, leadTimeKnown: leadTimeDays != null, hasStock: stock != null, noMovement: cls.noMovement,
    });

    results.push({
      sku,
      weeks,
      history: series,
      mean: Math.round(cls.mean * 10) / 10,
      cv: isFinite(cls.cv) ? Math.round(cls.cv * 100) / 100 : null,
      variability: cls.variability,
      trendLabel: cls.trendLabel,
      noMovement: cls.noMovement,
      lastSaleGapDays,
      forecastWeekly,
      accuracy: bt.accuracy,
      bias: bt.bias,
      stock,
      cost: stockInfo ? stockInfo.cost : null,
      daysOfSupply: dos == null ? null : Math.round(dos),
      risk,
      overstock,
      suggestedPurchase: purchase,
      confidence,
    });
  }

  return results.sort((a, b) => a.sku.localeCompare(b.sku));
}

// Genera el resumen priorizado tipo "planner al lado tuyo".
export function buildInsights(results, context = {}) {
  const insights = [];
  const highRisk = results.filter(r => r.risk.level === 'Alto');
  const overstocked = results.filter(r => r.overstock);
  const fastMoving = results.filter(r => {
    if (r.noMovement) return false;
    const lastActual = r.history.length ? r.history[r.history.length - 1].qty : 0;
    return r.forecastWeekly > 0 && lastActual > r.forecastWeekly * 1.3;
  });
  const noMovement = results.filter(r => r.noMovement);

  if (highRisk.length) insights.push({
    icon: '⚠️', text: `${highRisk.length} SKU presenta${highRisk.length === 1 ? '' : 'n'} riesgo de quiebre alto.`,
    skus: highRisk.map(r => r.sku),
  });
  if (overstocked.length) insights.push({
    icon: '📦', text: `${overstocked.length} SKU muestra${overstocked.length === 1 ? '' : 'n'} señales de exceso de inventario.`,
    skus: overstocked.map(r => r.sku),
  });
  if (fastMoving.length) insights.push({
    icon: '📈', text: `${fastMoving.length} SKU está${fastMoving.length === 1 ? '' : 'n'} vendiendo más rápido de lo esperado.`,
    skus: fastMoving.map(r => r.sku),
  });
  if (noMovement.length) insights.push({
    icon: '🛑', text: `${noMovement.length} SKU lleva${noMovement.length === 1 ? '' : 'n'} 60+ días sin movimiento.`,
    skus: noMovement.map(r => r.sku),
  });
  if (context.promoUnknown) insights.push({
    icon: '🔎', text: 'No sabemos si hay promociones futuras: podemos revisar tu histórico para sugerir posibles eventos estacionales.',
    skus: [],
  });
  if (context.promoYes) insights.push({
    icon: '🎯', text: 'Marcaste que hay promociones o eventos futuros: revisa que los SKU afectados tengan una estimación de demanda ajustada.',
    skus: [],
  });

  return insights;
}
