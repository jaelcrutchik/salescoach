import { parseSalesCSV, parseStockCSV, parseDate } from './parser.js';
import { analyze, buildInsights } from './analysis.js';
import { computeMaturity } from './maturity.js';
import {
  defaultState, loadState, saveState, resetState, GOALS, deriveContext, explainAvailableData,
} from './onboarding.js';

const app = document.getElementById('app');
const btnReset = document.getElementById('btnReset');

let state = loadState() || defaultState();
let uiFilters = { risk: 'all', variability: 'all' };
let expandedSku = null;

function persist() { saveState(state); }
function goTo(step) { state.step = step; persist(); render(); }

btnReset.hidden = false;
btnReset.addEventListener('click', () => {
  if (confirm('¿Reiniciar el onboarding y borrar los datos cargados en este navegador?')) {
    resetState();
    state = defaultState();
    uiFilters = { risk: 'all', variability: 'all' };
    render();
  }
});

// ---------- datos derivados del estado ----------

function getSalesRows() {
  let rows = [];
  if (state.salesText) rows = rows.concat(parseSalesCSV(state.salesText).rows);
  for (const r of state.manualRows) {
    const date = parseDate(r.fecha || '');
    const qty = parseFloat(r.venta);
    if (r.sku && date && !isNaN(qty)) rows.push({ sku: r.sku, date, qty });
  }
  return rows;
}

function getStockBySku() {
  const map = {};
  if (state.stockText) {
    for (const r of parseStockCSV(state.stockText).rows) map[r.sku] = { stock: r.stock, cost: r.cost };
  }
  return map;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Paso 1: objetivo ----------

function renderGoal() {
  app.innerHTML = `
    <div class="card">
      <div class="step-eyebrow">Paso 1 de 4</div>
      <h1>¿Qué quieres mejorar?</h1>
      <p class="step-help">Elige lo que más te importa hoy. Vas a poder seguir usando el sistema igual aunque tu prioridad cambie más adelante.</p>
      <div class="option-list">
        ${GOALS.map(g => `<button class="option-btn ${state.goal === g.key ? 'selected' : ''}" data-action="setGoal" data-value="${g.key}">${esc(g.label)}</button>`).join('')}
      </div>
      <div class="actions">
        <button class="btn" data-action="goUpload" ${state.goal ? '' : 'disabled'}>Continuar</button>
      </div>
    </div>
  `;
}

// ---------- Paso 2: qué información tienes ----------

function renderManualTable() {
  const rows = state.manualRows;
  return `
    <table class="manual-table">
      <thead><tr><th>SKU</th><th>Fecha</th><th>Venta</th><th></th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr data-row="${i}">
            <td><input type="text" data-field="sku" value="${esc(r.sku)}" placeholder="SKU-001" /></td>
            <td><input type="text" data-field="fecha" value="${esc(r.fecha)}" placeholder="AAAA-MM-DD" /></td>
            <td><input type="number" data-field="venta" value="${esc(r.venta)}" placeholder="0" /></td>
            <td><button class="btn ghost" data-action="removeManualRow" data-value="${i}">quitar</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <button class="btn secondary" data-action="addManualRow">+ agregar fila</button>
  `;
}

function renderUpload() {
  const salesRows = getSalesRows();
  const stockMap = getStockBySku();
  const hasSales = salesRows.length > 0;
  const hasStock = Object.keys(stockMap).length > 0;
  const skuCount = new Set(salesRows.map(r => r.sku)).size;
  const showManual = state.manualRows.length > 0 || !state.salesText;

  app.innerHTML = `
    <div class="card">
      <div class="step-eyebrow">Paso 2 de 4</div>
      <h1>¿Qué información tienes?</h1>
      <p class="step-help">Carga lo que tengas. Si no tienes nada estructurado todavía, puedes escribir algunas ventas a mano para empezar.</p>

      <div class="upload-grid">
        <div class="upload-box ${state.salesFileName ? 'filled' : ''}">
          <div class="upload-label">Excel / CSV de ventas</div>
          <div class="upload-hint">Columnas: SKU, fecha, venta</div>
          <input type="file" id="fileSales" accept=".csv" />
          ${state.salesFileName ? `<div class="upload-hint">✅ ${esc(state.salesFileName)}</div>` : ''}
        </div>
        <div class="upload-box ${state.stockFileName ? 'filled' : ''}">
          <div class="upload-label">Excel / CSV de stock (opcional)</div>
          <div class="upload-hint">Columnas: SKU, stock actual, costo (opcional)</div>
          <input type="file" id="fileStock" accept=".csv" />
          ${state.stockFileName ? `<div class="upload-hint">✅ ${esc(state.stockFileName)}</div>` : ''}
        </div>
      </div>

      <button class="btn ghost" data-action="toggleManual">${showManual ? 'Ocultar carga manual ▴' : 'No tengo archivos, escribir ventas a mano ▾'}</button>
      <div id="manualWrap">${showManual ? renderManualTable() : ''}</div>

      <div class="callout" id="uploadCallout">${uploadCalloutHtml(hasSales, hasStock, skuCount, Object.keys(stockMap).length)}</div>

      <div class="actions">
        <button class="btn secondary" data-action="goGoal">Atrás</button>
        <button class="btn" id="btnUploadContinue" data-action="goQuestions" ${hasSales ? '' : 'disabled'}>Continuar</button>
      </div>
      <div class="step-help" id="needSalesHint" style="margin-top:6px" ${hasSales ? 'hidden' : ''}>Necesitamos al menos algo de historial de ventas (aunque sea aproximado) para poder empezar.</div>
    </div>

    <div class="card">
      <h2>¿No tienes ningún archivo a mano?</h2>
      <p class="step-help">Descarga un ejemplo para ver el formato esperado.</p>
      <div class="actions">
        <a class="btn secondary" href="sample-data/ventas_ejemplo.csv" download>Descargar ventas de ejemplo</a>
        <a class="btn secondary" href="sample-data/stock_ejemplo.csv" download>Descargar stock de ejemplo</a>
      </div>
    </div>
  `;

  document.getElementById('fileSales').addEventListener('change', e => handleFile(e, 'sales'));
  document.getElementById('fileStock').addEventListener('change', e => handleFile(e, 'stock'));

  const manualWrap = document.getElementById('manualWrap');
  if (manualWrap) {
    // Actualizamos solo el resumen/botón (no toda la tarjeta) para no perder
    // el foco ni los valores en curso mientras se escribe fila por fila.
    manualWrap.addEventListener('change', e => {
      const rowEl = e.target.closest('tr[data-row]');
      if (!rowEl) return;
      const i = parseInt(rowEl.dataset.row, 10);
      const field = e.target.dataset.field;
      state.manualRows[i][field] = e.target.value;
      persist();
      updateUploadDerived();
    });
  }
}

function uploadCalloutHtml(hasSales, hasStock, skuCount, stockCount) {
  return `
    ${explainAvailableData({ hasSales, hasStock })}
    ${hasSales ? `<div style="margin-top:6px;color:var(--muted);font-size:.85rem">Detectamos ${skuCount} SKU con historial de ventas${hasStock ? ` y ${stockCount} con stock cargado` : ''}.</div>` : ''}
  `;
}

function updateUploadDerived() {
  const salesRows = getSalesRows();
  const stockMap = getStockBySku();
  const hasSales = salesRows.length > 0;
  const hasStock = Object.keys(stockMap).length > 0;
  const skuCount = new Set(salesRows.map(r => r.sku)).size;

  const callout = document.getElementById('uploadCallout');
  if (callout) callout.innerHTML = uploadCalloutHtml(hasSales, hasStock, skuCount, Object.keys(stockMap).length);
  const btn = document.getElementById('btnUploadContinue');
  if (btn) btn.disabled = !hasSales;
  const hint = document.getElementById('needSalesHint');
  if (hint) hint.hidden = hasSales;
}

function handleFile(evt, kind) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (kind === 'sales') { state.salesText = reader.result; state.salesFileName = file.name; }
    else { state.stockText = reader.result; state.stockFileName = file.name; }
    persist();
    renderUpload();
  };
  reader.readAsText(file);
}

// ---------- Paso 3: preguntas guiadas ----------

const QUESTION_STEPS = ['q_leadtime', 'q_safety', 'q_promo'];

function questionProgress(step) {
  const i = QUESTION_STEPS.indexOf(step);
  return `Pregunta ${i + 1} de ${QUESTION_STEPS.length}`;
}

function nextQuestionStep(current) {
  const i = QUESTION_STEPS.indexOf(current);
  return i < QUESTION_STEPS.length - 1 ? QUESTION_STEPS[i + 1] : 'dashboard';
}

function prevQuestionStep(current) {
  const i = QUESTION_STEPS.indexOf(current);
  return i > 0 ? QUESTION_STEPS[i - 1] : 'upload';
}

function renderLeadTimeQuestion() {
  const lt = state.leadTime;
  app.innerHTML = `
    <div class="card">
      <div class="step-eyebrow">Paso 3 de 4 · ${questionProgress('q_leadtime')}</div>
      <div class="qa-question">Desde que haces un pedido al proveedor hasta que recibes el producto, ¿cuánto tiempo suele pasar?</div>
      <div class="qa-sub">Una aproximación está bien. Si no lo sabes, igual puedes continuar.</div>
      <div class="option-list">
        ${optionBtn('leadtime_unit', 'dias', 'Días', lt.unit === 'dias' && lt.answer === 'valor')}
        ${optionBtn('leadtime_unit', 'semanas', 'Semanas', lt.unit === 'semanas' && lt.answer === 'valor')}
        ${optionBtn('leadtime_unit', 'meses', 'Meses', lt.unit === 'meses' && lt.answer === 'valor')}
        ${optionBtn('leadtime_ans', 'depende', 'Depende del proveedor', lt.answer === 'depende')}
        ${optionBtn('leadtime_ans', 'no_se', 'No sé', lt.answer === 'no_se')}
      </div>
      ${lt.answer === 'valor' ? `
        <div class="inline-input">
          <span>Cantidad aproximada:</span>
          <input type="number" min="0" id="leadTimeValue" value="${esc(lt.value ?? '')}" />
        </div>
      ` : ''}
      ${lt.answer === 'no_se' ? '<div class="callout warn">Sin problema. Vamos a marcar los cálculos que dependen de esto con menor confianza, y podrás cargar este dato más adelante.</div>' : ''}
      <div class="actions">
        <button class="btn secondary" data-action="goPrevQuestion" data-value="q_leadtime">Atrás</button>
        <button class="btn ghost" data-action="skipQuestion" data-value="q_leadtime">Prefiero no responder</button>
        <button class="btn" data-action="goNextQuestion" data-value="q_leadtime">Continuar</button>
      </div>
    </div>
  `;
  const valInput = document.getElementById('leadTimeValue');
  if (valInput) valInput.addEventListener('change', e => {
    state.leadTime.value = e.target.value;
    persist();
  });
}

function renderSafetyQuestion() {
  const ss = state.safetyStock;
  app.innerHTML = `
    <div class="card">
      <div class="step-eyebrow">Paso 3 de 4 · ${questionProgress('q_safety')}</div>
      <div class="qa-question">¿Mantienes una cantidad mínima de stock que no quieres tocar?</div>
      <div class="qa-sub">Ese "colchón" se conoce técnicamente como safety stock. Si no tienes uno definido, el sistema puede empezar sin él y más adelante sugerir una política.</div>
      <div class="option-list">
        ${optionBtn('safety_ans', 'si', 'Sí', ss.answer === 'si')}
        ${optionBtn('safety_ans', 'no', 'No', ss.answer === 'no')}
        ${optionBtn('safety_ans', 'no_se', 'No sé', ss.answer === 'no_se')}
      </div>
      ${ss.answer === 'si' ? `
        <div class="inline-input">
          <span>¿A cuántos días de cobertura extra te gustaría que equivalga ese mínimo (aproximado)?</span>
          <input type="number" min="0" id="safetyDays" value="${esc(ss.days ?? '')}" />
        </div>
      ` : ''}
      <div class="actions">
        <button class="btn secondary" data-action="goPrevQuestion" data-value="q_safety">Atrás</button>
        <button class="btn ghost" data-action="skipQuestion" data-value="q_safety">Prefiero no responder</button>
        <button class="btn" data-action="goNextQuestion" data-value="q_safety">Continuar</button>
      </div>
    </div>
  `;
  const daysInput = document.getElementById('safetyDays');
  if (daysInput) daysInput.addEventListener('change', e => {
    state.safetyStock.days = e.target.value;
    persist();
  });
}

function renderPromoQuestion() {
  const p = state.promo;
  app.innerHTML = `
    <div class="card">
      <div class="step-eyebrow">Paso 3 de 4 · ${questionProgress('q_promo')}</div>
      <div class="qa-question">¿Hay promociones, campañas, temporadas especiales o situaciones futuras que esperas que hagan vender más o menos de lo habitual?</div>
      <div class="option-list">
        ${optionBtn('promo_ans', 'si', 'Sí', p.answer === 'si')}
        ${optionBtn('promo_ans', 'no', 'No', p.answer === 'no')}
        ${optionBtn('promo_ans', 'no_se', 'No sé', p.answer === 'no_se')}
      </div>
      ${p.answer === 'si' ? `
        <div class="inline-input" style="width:100%">
          <textarea id="promoDetail" placeholder="Cuéntanos brevemente qué esperas (ej: campaña de fin de año en noviembre)" style="width:100%;min-height:70px;padding:10px;border:1px solid var(--border);border-radius:8px">${esc(p.detail ?? '')}</textarea>
        </div>
      ` : ''}
      ${p.answer === 'no_se' ? '<div class="callout">Sin problema: podemos revisar tu histórico y sugerir posibles patrones estacionales.</div>' : ''}
      <div class="actions">
        <button class="btn secondary" data-action="goPrevQuestion" data-value="q_promo">Atrás</button>
        <button class="btn ghost" data-action="skipQuestion" data-value="q_promo">Prefiero no responder</button>
        <button class="btn" data-action="goNextQuestion" data-value="q_promo">Ver resultados</button>
      </div>
    </div>
  `;
  const detailInput = document.getElementById('promoDetail');
  if (detailInput) detailInput.addEventListener('change', e => {
    state.promo.detail = e.target.value;
    persist();
  });
}

function optionBtn(group, value, label, selected) {
  return `<button class="option-btn ${selected ? 'selected' : ''}" data-action="setQuestionOption" data-group="${group}" data-value="${value}">${esc(label)}</button>`;
}

// ---------- Paso 4: dashboard ----------

function pillForRisk(level) {
  const cls = level === 'Alto' ? 'bad' : level === 'Medio' ? 'warn' : level === 'Bajo' ? 'ok' : 'neutral';
  return `<span class="pill ${cls}">${esc(level)}</span>`;
}

function pillForConfidence(level) {
  const cls = level === 'Alta' ? 'ok' : level === 'Media' ? 'warn' : 'bad';
  return `<span class="pill ${cls}">${esc(level)}</span>`;
}

function explainBias(bias) {
  if (bias == null) return 'No hay suficiente historial todavía para calcular este dato con confianza.';
  const abs = Math.abs(bias);
  if (bias < -3) return `Tus pronósticos tienden a quedarse aproximadamente ${abs}% por debajo de las ventas reales.`;
  if (bias > 3) return `Tus pronósticos tienden a superar aproximadamente ${abs}% las ventas reales.`;
  return 'Tus pronósticos no muestran un sesgo claro por encima o por debajo de las ventas reales.';
}

function explainAccuracy(acc) {
  if (acc == null) return 'Todavía no hay suficiente historial para medir qué tan preciso es el forecast de este producto.';
  if (acc >= 90) return 'Históricamente, la estimación ha estado muy cerca de la demanda real.';
  if (acc >= 75) return 'Históricamente, la estimación está razonablemente cerca de la demanda real, aunque existe espacio para mejorar.';
  return 'Históricamente, la estimación ha mostrado diferencias importantes respecto a la demanda real: conviene revisar este producto con más atención.';
}

function explainDaysOfSupply(dos) {
  if (dos == null) return 'Necesitamos el stock actual de este producto para calcular la cobertura.';
  return `Si las ventas siguen el comportamiento esperado, el stock actual alcanzaría aproximadamente para ${dos} días.`;
}

function explainRisk(risk, leadTimeDays) {
  const base = {
    Alto: 'Probablemente necesitarás reponer antes de que llegue el próximo abastecimiento.',
    Medio: 'La cobertura está justa: conviene revisar este producto pronto.',
    Bajo: 'La cobertura actual luce suficiente por ahora.',
    Desconocido: 'Necesitamos el stock actual para estimar el riesgo de quiebre.',
  }[risk.level];
  if (risk.preliminary) return `${base} (Estimación preliminar: no conocemos tu lead time real, así que usamos un umbral general.)`;
  if (risk.level !== 'Desconocido' && leadTimeDays == null) return base;
  return base;
}

function explainConfidence(row, leadTimeDays) {
  if (row.confidence === 'Alta') {
    return 'Buen historial, poca variabilidad y los datos clave necesarios ya están disponibles.';
  }
  const reasons = [];
  if (row.weeks < 12) reasons.push('poco historial disponible');
  if (row.cv != null && row.cv >= 0.5) reasons.push('demanda con variabilidad alta');
  if (row.noMovement) reasons.push('el producto no tiene ventas recientes');
  if (row.stock == null) reasons.push('no conocemos el stock actual');
  if (leadTimeDays == null) reasons.push('no conocemos con precisión el tiempo de reposición del proveedor');
  if (!reasons.length) reasons.push('la combinación de señales todavía no alcanza para una confianza alta');
  return `Motivo: ${reasons.join('; ')}.`;
}

function renderDashboard() {
  const salesRows = getSalesRows();
  const stockBySku = getStockBySku();
  const context = deriveContext(state);
  const results = analyze({ salesRows, stockBySku, context });
  const insights = buildInsights(results, context);

  const flags = {
    ventas: salesRows.length > 0,
    stock: Object.keys(stockBySku).length > 0,
    leadTime: context.leadTimeDays != null,
    stockTransito: false,
    promociones: context.promoYes,
    safetyStock: state.safetyStock.answer === 'si',
    costo: Object.values(stockBySku).some(s => s.cost != null),
  };
  const maturity = computeMaturity(flags);

  const filtered = results.filter(r =>
    (uiFilters.risk === 'all' || r.risk.level === uiFilters.risk) &&
    (uiFilters.variability === 'all' || r.variability === uiFilters.variability)
  );

  const totalAttention = new Set([
    ...results.filter(r => r.risk.level === 'Alto').map(r => r.sku),
    ...results.filter(r => r.overstock).map(r => r.sku),
    ...results.filter(r => r.noMovement).map(r => r.sku),
  ]).size;

  app.innerHTML = `
    <div class="card">
      <div class="step-eyebrow">Resumen</div>
      <h1>${totalAttention > 0 ? `Hoy hay ${totalAttention} producto${totalAttention === 1 ? '' : 's'} que requiere${totalAttention === 1 ? '' : 'n'} atención` : 'Todo luce bajo control por ahora'}</h1>
      <ul class="insights-list">
        ${insights.map(ins => `
          <li>
            <span>${ins.icon}</span>
            <div>
              <div>${esc(ins.text)}</div>
              ${ins.skus.length ? `<div class="skus">${ins.skus.slice(0, 12).join(', ')}${ins.skus.length > 12 ? '…' : ''}</div>` : ''}
            </div>
          </li>
        `).join('') || '<li>Aún no detectamos alertas con la información disponible.</li>'}
      </ul>
    </div>

    <div class="card">
      <div class="step-eyebrow">Madurez de planificación</div>
      <div class="maturity-panel">
        <div class="maturity-badge"><span class="lvl">${maturity.nivel}</span><span class="lbl">${esc(maturity.label)}</span></div>
        <div class="maturity-missing">
          <div>Los datos que más mejorarían tus recomendaciones:</div>
          ${maturity.missing.length ? `<ol>${maturity.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ol>` : '<div class="step-help">Ya tienes cargados los datos clave. 🎉</div>'}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title-row">
        <h2>Detalle por SKU (${filtered.length}/${results.length})</h2>
      </div>
      <div class="filters">
        <select id="filterRisk">
          <option value="all">Riesgo: todos</option>
          <option value="Alto">Riesgo: Alto</option>
          <option value="Medio">Riesgo: Medio</option>
          <option value="Bajo">Riesgo: Bajo</option>
          <option value="Desconocido">Riesgo: Desconocido</option>
        </select>
        <select id="filterVariability">
          <option value="all">Clasificación: todas</option>
          <option value="estable">Estable</option>
          <option value="irregular">Irregular</option>
          <option value="sin_ventas">Sin ventas</option>
        </select>
      </div>
      <div style="overflow-x:auto">
        <table class="sku-table">
          <thead>
            <tr>
              <th>SKU</th><th>Clasificación</th><th>Forecast/sem</th><th>Accuracy</th><th>Bias</th>
              <th>Cobertura (días)</th><th>Riesgo</th><th>Compra sugerida</th><th>Confianza</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => renderSkuRow(r, context)).join('')}
          </tbody>
        </table>
      </div>
      ${!results.length ? '<p class="step-help">No encontramos SKU para analizar.</p>' : ''}
    </div>

    <div class="actions">
      <button class="btn secondary" data-action="goUpload">Cargar otro archivo</button>
      <button class="btn secondary" data-action="goQuestionsFromDashboard">Revisar respuestas de negocio</button>
    </div>
  `;

  document.getElementById('filterRisk').value = uiFilters.risk;
  document.getElementById('filterRisk').addEventListener('change', e => { uiFilters.risk = e.target.value; renderDashboard(); });
  document.getElementById('filterVariability').value = uiFilters.variability;
  document.getElementById('filterVariability').addEventListener('change', e => { uiFilters.variability = e.target.value; renderDashboard(); });

  document.querySelectorAll('tr.expandable').forEach(tr => {
    tr.addEventListener('click', () => {
      const sku = tr.dataset.sku;
      expandedSku = expandedSku === sku ? null : sku;
      renderDashboard();
    });
  });
}

function classificationLabel(r) {
  const parts = [];
  parts.push({ estable: 'Estable', irregular: 'Irregular', sin_ventas: 'Sin ventas' }[r.variability] || r.variability);
  if (r.trendLabel === 'creciente') parts.push('creciente');
  if (r.trendLabel === 'decreciente') parts.push('decreciente');
  if (r.noMovement) parts.push('sin movimiento');
  return parts.join(' · ');
}

function renderSkuRow(r, context) {
  const isOpen = expandedSku === r.sku;
  const rows = [`
    <tr class="expandable" data-sku="${esc(r.sku)}">
      <td><strong>${esc(r.sku)}</strong></td>
      <td>${esc(classificationLabel(r))}</td>
      <td>${r.forecastWeekly}</td>
      <td>${r.accuracy != null ? r.accuracy + '%' : '—'}</td>
      <td>${r.bias != null ? r.bias + '%' : '—'}</td>
      <td>${r.daysOfSupply != null ? r.daysOfSupply : '—'}</td>
      <td>${pillForRisk(r.risk.level)}${r.risk.preliminary ? ' <span class="confidence">(preliminar)</span>' : ''}</td>
      <td>${r.suggestedPurchase != null ? r.suggestedPurchase + ' u.' : '—'}</td>
      <td>${pillForConfidence(r.confidence)}</td>
    </tr>
  `];
  if (isOpen) {
    rows.push(`
      <tr class="detail-row">
        <td colspan="9">
          <div class="detail-grid">
            <div class="detail-item"><div class="k">Forecast Accuracy: ${r.accuracy != null ? r.accuracy + '%' : 'sin datos suficientes'}</div><div class="v">${esc(explainAccuracy(r.accuracy))}</div></div>
            <div class="detail-item"><div class="k">Bias: ${r.bias != null ? r.bias + '%' : 'sin datos suficientes'}</div><div class="v">${esc(explainBias(r.bias))}</div></div>
            <div class="detail-item"><div class="k">Cobertura de stock: ${r.daysOfSupply != null ? r.daysOfSupply + ' días' : 'sin stock cargado'}</div><div class="v">${esc(explainDaysOfSupply(r.daysOfSupply))}</div></div>
            <div class="detail-item"><div class="k">Riesgo de quiebre: ${r.risk.level}</div><div class="v">${esc(explainRisk(r.risk, context.leadTimeDays))}</div></div>
            <div class="detail-item"><div class="k">Confianza de la recomendación: ${r.confidence}</div><div class="v">${esc(explainConfidence(r, context.leadTimeDays))}</div></div>
            <div class="detail-item"><div class="k">Historial</div><div class="v">${r.weeks} semana(s) de datos, promedio ${r.mean} u./semana${r.overstock ? ', posible sobrestock' : ''}.</div></div>
          </div>
        </td>
      </tr>
    `);
  }
  return rows.join('');
}

// ---------- delegación de eventos ----------

app.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const value = btn.dataset.value;

  switch (action) {
    case 'setGoal':
      state.goal = value; persist(); renderGoal(); break;
    case 'goGoal':
      goTo('goal'); break;
    case 'goUpload':
      goTo('upload'); break;
    case 'toggleManual': {
      if (state.manualRows.length === 0) state.manualRows.push({ sku: '', fecha: '', venta: '' });
      else state.manualRows = [];
      persist(); renderUpload(); break;
    }
    case 'addManualRow':
      state.manualRows.push({ sku: '', fecha: '', venta: '' }); persist(); renderUpload(); break;
    case 'removeManualRow':
      state.manualRows.splice(parseInt(value, 10), 1); persist(); renderUpload(); break;
    case 'goQuestions':
      goTo('q_leadtime'); break;
    case 'goQuestionsFromDashboard':
      goTo('q_leadtime'); break;
    case 'setQuestionOption':
      handleQuestionOption(btn.dataset.group, value); break;
    case 'goNextQuestion':
      goTo(nextQuestionStep(value)); break;
    case 'goPrevQuestion':
      goTo(prevQuestionStep(value)); break;
    case 'skipQuestion':
      goTo(nextQuestionStep(value)); break;
    default: break;
  }
});

function handleQuestionOption(group, value) {
  switch (group) {
    case 'leadtime_unit':
      state.leadTime.answer = 'valor'; state.leadTime.unit = value; break;
    case 'leadtime_ans':
      state.leadTime.answer = value; state.leadTime.unit = null; state.leadTime.value = null; break;
    case 'safety_ans':
      state.safetyStock.answer = value; if (value !== 'si') state.safetyStock.days = null; break;
    case 'promo_ans':
      state.promo.answer = value; if (value !== 'si') state.promo.detail = null; break;
    default: break;
  }
  persist();
  render();
}

// ---------- router ----------

function render() {
  switch (state.step) {
    case 'goal': renderGoal(); break;
    case 'upload': renderUpload(); break;
    case 'q_leadtime': renderLeadTimeQuestion(); break;
    case 'q_safety': renderSafetyQuestion(); break;
    case 'q_promo': renderPromoQuestion(); break;
    case 'dashboard': renderDashboard(); break;
    default: renderGoal(); break;
  }
}

render();
