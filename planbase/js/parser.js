// Parseo de CSV sin dependencias externas (funciona offline, sin CDN).

export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',' || c === ';') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { pushRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) pushRow();
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

function normalizeHeader(h) {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function findColumn(headers, aliases) {
  for (let idx = 0; idx < headers.length; idx++) {
    if (aliases.includes(headers[idx])) return idx;
  }
  return -1;
}

const SALES_ALIASES = {
  sku: ['sku', 'codigo', 'cod', 'producto', 'item', 'articulo'],
  date: ['fecha', 'date', 'dia', 'semana'],
  qty: ['venta', 'ventas', 'cantidad', 'unidades', 'qty', 'unidades_vendidas', 'demanda'],
};

const STOCK_ALIASES = {
  sku: ['sku', 'codigo', 'cod', 'producto', 'item', 'articulo'],
  stock: ['stock', 'stock_actual', 'existencia', 'inventario', 'inventario_actual'],
  cost: ['costo', 'cost', 'precio_costo', 'costo_unitario'],
};

export function parseDate(str) {
  const s = str.trim();
  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // DD/MM/YYYY o DD-MM-YYYY (convención LatAm)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function parseSalesCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { rows: [], warnings: ['El archivo de ventas no tiene filas de datos.'] };
  const headers = rows[0].map(normalizeHeader);
  const iSku = findColumn(headers, SALES_ALIASES.sku);
  const iDate = findColumn(headers, SALES_ALIASES.date);
  const iQty = findColumn(headers, SALES_ALIASES.qty);
  const warnings = [];
  if (iSku === -1 || iDate === -1 || iQty === -1) {
    warnings.push('No pudimos identificar las columnas de SKU, fecha y venta. Verifica los encabezados del archivo.');
    return { rows: [], warnings };
  }
  const out = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sku = (row[iSku] || '').trim();
    const date = parseDate(row[iDate] || '');
    const qty = parseFloat((row[iQty] || '').replace(',', '.'));
    if (!sku || !date || isNaN(qty)) { skipped++; continue; }
    out.push({ sku, date, qty });
  }
  if (skipped) warnings.push(`${skipped} fila(s) se ignoraron por datos incompletos o inválidos.`);
  return { rows: out, warnings };
}

export function parseStockCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { rows: [], warnings: ['El archivo de stock no tiene filas de datos.'] };
  const headers = rows[0].map(normalizeHeader);
  const iSku = findColumn(headers, STOCK_ALIASES.sku);
  const iStock = findColumn(headers, STOCK_ALIASES.stock);
  const iCost = findColumn(headers, STOCK_ALIASES.cost);
  const warnings = [];
  if (iSku === -1 || iStock === -1) {
    warnings.push('No pudimos identificar las columnas de SKU y stock. Verifica los encabezados del archivo.');
    return { rows: [], warnings };
  }
  const out = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sku = (row[iSku] || '').trim();
    const stock = parseFloat((row[iStock] || '').replace(',', '.'));
    const cost = iCost === -1 ? null : parseFloat((row[iCost] || '').replace(',', '.'));
    if (!sku || isNaN(stock)) { skipped++; continue; }
    out.push({ sku, stock, cost: isNaN(cost) ? null : cost });
  }
  if (skipped) warnings.push(`${skipped} fila(s) de stock se ignoraron por datos incompletos o inválidos.`);
  return { rows: out, warnings };
}
