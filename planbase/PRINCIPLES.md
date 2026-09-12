# PlanBase — Principios Fundamentales

Este documento es la constitución del producto. Toda decisión de diseño o
desarrollo debe poder trazarse a alguno de estos principios. Si una
funcionalidad nueva contradice esto, el principio gana.

## PRINCIPIO FUNDAMENTAL: DEBE FUNCIONAR DESDE CERO

Asume que una parte importante de las empresas que utilizarán este sistema
puede estar en una situación como esta:

- No tienen forecast.
- No tienen proceso formal de Demand Planning.
- No conocen Forecast Accuracy.
- No conocen Bias.
- No tienen baseline.
- No tienen uplift.
- No tienen promociones estructuradas.
- No tienen Safety Stock definido.
- No conocen correctamente sus Lead Times.
- No tienen clasificación ABC/XYZ.
- No tienen parámetros de inventario.
- No tienen políticas de compra.
- No tienen un equipo especializado de Supply Chain.
- No saben qué información deberían utilizar para planificar.
- Incluso pueden tener solamente ventas históricas y stock actual en Excel.

El sistema debe ser capaz de partir desde ese nivel. NO debe exigir que la
empresa ya tenga un proceso de planificación maduro. Al contrario: una de
las funciones del sistema debe ser ayudar a construir ese proceso.

## MODO "EMPEZAR DESDE CERO"

Debe existir conceptualmente un onboarding muy simple. En vez de preguntar
conceptos técnicos, se realizan preguntas de negocio.

**"¿Qué quieres mejorar?"**
- Evitar quedarme sin stock.
- Comprar mejor.
- Saber cuánto venderé.
- Reducir exceso de inventario.
- Ordenar mi proceso de planificación.
- Todo lo anterior.

**"¿Qué información tienes?"** — permitir que el usuario cargue lo que
tenga: Excel de ventas, Excel de stock, o nada estructurado todavía.

El sistema analiza los archivos y explica qué puede hacer con ellos
("Con la información disponible ya podemos comenzar a estimar demanda y
detectar productos con riesgo de quiebre"), y luego identifica información
faltante que aumentaría la calidad del análisis, siempre en preguntas de
negocio, nunca en jerga técnica:

- Lead time → "Desde que haces un pedido al proveedor hasta que recibes el
  producto, ¿cuánto tiempo suele pasar?" (días / semanas / meses / depende
  del proveedor / no sé). Si responde "no sé", se continúa y ese cálculo
  queda marcado con menor confianza.
- Safety stock → "¿Mantienes una cantidad mínima de stock que no quieres
  tocar?" (Sí / No / No sé). Si no existe, el sistema arranca sin Safety
  Stock y más adelante puede recomendar una política.
- Uplift/promociones → "¿Hay promociones, campañas, temporadas especiales o
  situaciones futuras que esperas que hagan vender más o menos de lo
  habitual?" Si no sabe, el sistema puede revisar patrones históricos y
  sugerir posibles eventos estacionales.
- Modelo de forecast → nunca se pregunta. El sistema lo selecciona
  automáticamente y lo explica en lenguaje simple ("Analizamos diferentes
  métodos y este es el que mejor ha funcionado históricamente para este
  producto").

## PRIMER RESULTADO CON MUY POCA INFORMACIÓN

Con solo SKU, fecha, venta y stock actual, el sistema ya debe entregar una
primera versión de: histórico de demanda, forecast por SKU, tendencia,
estacionalidad, variabilidad, clasificación (estable / irregular / sin
movimiento / creciente / decreciente), cobertura aproximada de stock,
riesgo preliminar de quiebre, posible sobrestock, forecast accuracy vía
backtesting, bias y alertas básicas — explicando siempre qué cálculos son
preliminares por falta de parámetros de abastecimiento.

## MADUREZ PROGRESIVA

- **Nivel 0 — Sin planificación**: ventas (+ quizás stock) → forecast
  inicial, análisis de comportamiento, alertas básicas.
- **Nivel 1 — Forecast básico**: + stock + lead time aproximado → Days of
  Supply, riesgo de quiebre, compra sugerida básica.
- **Nivel 2 — Inventory Planning**: + stock en tránsito, órdenes,
  proveedores, MOQ, múltiplos → Inventory Projection, compra recomendada,
  fecha recomendada de compra.
- **Nivel 3 — Demand Planning**: + promociones, eventos, forecast de
  negocio, overrides → baseline, uplift, Final Forecast, FVA.
- **Nivel 4 — Advanced Planning**: + precios, service level, costos, lead
  time variable, quiebres históricos, lost sales → Safety Stock
  estadístico, optimización, causal forecasting, escenarios, working
  capital.

El usuario nunca debe sentir que "le faltan datos". Debe sentir "puedo
empezar hoy y mejorar con el tiempo".

## DATA MATURITY SCORE

Evalúa automáticamente qué tan desarrollada está la empresa en términos de
información disponible (ventas, stock, lead time, órdenes de compra,
promociones, safety stock, costo, forecast actual) y muestra la madurez
actual más los 3 datos que más mejorarían las recomendaciones. No es un
score para juzgar a la empresa — es para guiar el siguiente paso.

## EL SISTEMA TAMBIÉN ENSEÑA

Todo indicador técnico se acompaña de una explicación en lenguaje simple
(Bias, Days of Supply, Forecast Accuracy, Risk of Stockout, etc.).

## CONFIANZA DE LA RECOMENDACIÓN

No todas las recomendaciones tienen el mismo nivel de certeza. Cada
recomendación se etiqueta con Alta / Media / Baja confianza y el motivo
("no conocemos con precisión el tiempo de reposición del proveedor"), para
evitar entregar números aparentemente exactos cuando la información es
incompleta.

## ASISTENTE DE PLANIFICACIÓN

El sistema se comporta como un planner experimentado sentado al lado del
usuario: interpreta la información y prioriza ("Hay 8 productos que
requieren atención hoy"), en vez de limitarse a mostrar dashboards. El
objetivo final es convertir datos en decisiones.

## PRIORIDAD DE DESARROLLO

Se diseña siempre en este orden: (1) empresa que no sabe nada, (2) empresa
con información básica, (3) empresa con procesos intermedios, (4) empresa
madura. Nunca se diseña primero para el nivel 4 y después se simplifica.
La sofisticación matemática puede ser alta internamente; la interacción
debe permanecer simple.

**Filosofía central:**
- "Empieza con lo que tienes."
- "El sistema te ayuda a descubrir lo que te falta."
- "Cada dato adicional mejora las recomendaciones."
- "No necesitas ser experto en Supply Chain para tomar mejores decisiones."
