# PlanBase

Sistema de Demand & Inventory Planning diseñado para funcionar **desde
cero**: empresas sin forecast, sin proceso de planificación formal y con
apenas un Excel de ventas y stock ya pueden empezar. Ver [`PRINCIPLES.md`](./PRINCIPLES.md)
para los principios de producto que gobiernan todo el diseño.

## Qué hace hoy (v1 / MVP)

- **Onboarding conversacional**: pregunta objetivos de negocio ("¿qué
  quieres mejorar?") y qué información existe, sin jerga técnica.
- **Carga de datos**: CSV de ventas (`sku, fecha, venta`) y de stock
  (`sku, stock, costo` opcional), o carga manual fila por fila si no hay
  archivos todavía.
- **Preguntas guiadas** (todas opcionales, con "no sé" como respuesta
  válida) sobre lead time, safety stock y promociones/estacionalidad.
- **Motor de análisis por SKU** (100% en el navegador, sin backend):
  histórico semanal, tendencia, variabilidad (CV), clasificación
  (estable / irregular / sin movimiento / creciente / decreciente),
  forecast (Holt / suavizado exponencial), forecast accuracy y bias vía
  backtesting, cobertura de stock (Days of Supply), riesgo de quiebre,
  posible sobrestock, compra sugerida y **confianza de la recomendación**.
- **Data Maturity Score**: nivel actual (0-4) + los 3 datos que más
  mejorarían las recomendaciones.
- **Asistente de planificación**: resumen priorizado ("Hoy hay N
  productos que requieren atención") en vez de solo un dashboard.
- Cada métrica técnica se muestra con su explicación en español simple.

## Qué falta (roadmap, no bloquea el uso hoy)

- Nivel 2 (stock en tránsito, órdenes de compra, MOQ) y Nivel 4
  (safety stock estadístico, optimización, causal forecasting, escenarios)
  del modelo de madurez todavía no tienen flujo de carga de datos propio.
- Persistencia multiusuario / backend (hoy vive en `localStorage` del
  navegador — sirve para validar el producto, no para producción
  multi-cliente).
- Detección de estacionalidad más allá de tendencia lineal simple.
- Vinculación de promociones a SKUs específicos (hoy es una señal
  general, no por producto).

## Desarrollo local

No requiere build ni dependencias — es HTML/CSS/JS plano.

```bash
cd planbase
npm run dev
# abre http://localhost:4173
```

## Estructura

```
planbase/
  PRINCIPLES.md        # principios de producto (la "constitución")
  index.html
  css/styles.css
  js/
    parser.js           # parseo de CSV (ventas/stock) sin dependencias externas
    analysis.js         # motor de forecast/clasificación/riesgo/confianza por SKU
    maturity.js         # Data Maturity Score
    onboarding.js        # estado y lógica del wizard
    app.js               # wiring de UI + render del dashboard
  sample-data/
    ventas_ejemplo.csv
    stock_ejemplo.csv
```
