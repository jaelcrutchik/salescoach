// Data Maturity Score: no juzga a la empresa, guía el próximo paso.

export const MATURITY_FIELDS = [
  { key: 'ventas', label: 'Ventas históricas' },
  { key: 'stock', label: 'Stock actual', weight: 5 },
  { key: 'leadTime', label: 'Lead time (tiempo de reposición)', weight: 4 },
  { key: 'stockTransito', label: 'Stock en tránsito / órdenes de compra', weight: 3 },
  { key: 'promociones', label: 'Promociones o eventos futuros', weight: 2 },
  { key: 'safetyStock', label: 'Safety stock (mínimo que no se toca)', weight: 1 },
  { key: 'costo', label: 'Costo unitario', weight: 1 },
];

const LEVEL_LABELS = ['Inicial', 'Básico', 'Intermedio', 'Avanzado', 'Óptimo'];

export function computeMaturity(flags) {
  let nivel = 0;
  if (flags.ventas) nivel = 0;
  if (flags.ventas && flags.stock && flags.leadTime) nivel = 1;
  if (nivel >= 1 && flags.stockTransito) nivel = 2;
  if (flags.ventas && flags.stock && flags.leadTime && flags.promociones) nivel = Math.max(nivel, 3);

  const missing = MATURITY_FIELDS
    .filter(f => f.weight && !flags[f.key])
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(f => f.label);

  return { nivel, label: LEVEL_LABELS[nivel], missing, flags };
}
