/**
 * Language switch (English / Español) for the Larkspur Music apps.
 *
 * English is the source language: every module, and every native Astrato object, keeps rendering English. A
 * MutationObserver translates text nodes and the placeholder / title / aria-label attributes as they reach the
 * page, and puts the English back on return. Native tables and charts render their headers, axis labels and data
 * values as page text, so they are translated by the same path, while selections and writebacks keep using the
 * English values the warehouse holds. Shared by larkspur-close/ and larkspur-recovery/ (one dictionary).
 * Not translated: proper names (payees, songs, payers, people), IDs, numbers and the Excel export.
 */
const STORAGE_KEY = 'royalty-lang-v1';
export const LANGUAGES = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }];

const ES = {
  // ---- shell
  'Close overview': 'Resumen del cierre', 'Statement investigation': 'Investigación de liquidación', 'Controller review': 'Revisión del controller', 'Close simulator': 'Simulador de cierre', 'Business questions': 'Preguntas de negocio',
  'Opportunity queue': 'Cola de oportunidades', 'Claim detail': 'Detalle de reclamación', 'Recovery tracking': 'Seguimiento de recuperaciones', 'Recovery what-if': 'Simulación de recuperación',
  'DEMO DATA': 'DATOS DEMO', 'Reset demo': 'Reiniciar demo', '⬇ Excel close pack': '⬇ Paquete de cierre Excel', '⬇ Excel recovery pack': '⬇ Paquete de recuperación Excel', 'Building…': 'Generando…',
  'Clears this browser’s fallback copy and reloads (warehouse reset: see the README)': 'Borra la copia local de este navegador y recarga (reinicio en el almacén: ver el README)',
  'Royalty Close & Exception Review': 'Cierre de regalías y revisión de excepciones', 'Paid vs Collectable Recovery': 'Recuperación pagado vs cobrable',
  Branch: 'Sucursal', 'All branches': 'Todas las sucursales', 'all branches': 'todas las sucursales', 'Processing run': 'Ejecución de proceso', 'Processing Run': 'Ejecución de proceso', 'All runs': 'Todas las ejecuciones', Currency: 'Moneda', 'All currencies': 'Todas las monedas', 'Accounting period': 'Periodo contable', 'Accounting Period': 'Periodo contable', 'All periods': 'Todos los periodos', Clear: 'Borrar', Language: 'Idioma',
  'Acting as (role + branch access)': 'Actuando como (rol + acceso a sucursal)', 'Acting as (role + branch access are enforced on every write)': 'Actuando como (rol y acceso a sucursal se aplican en cada escritura)',
  'Royalty Analyst': 'Analista de regalías', 'Finance Controller': 'Controller financiero', Viewer: 'Lector', 'Income Tracking Analyst': 'Analista de seguimiento de ingresos', 'Claims Owner': 'Responsable de reclamaciones', 'Finance (Recovery)': 'Finanzas (recuperación)',
  Selections: 'Selecciones', 'Clear all': 'Borrar todo', Remove: 'Quitar', 'None. Use the header dropdowns, the filters, or click a row or bar.': 'Ninguna. Use los desplegables de la cabecera, los filtros o haga clic en una fila o barra.',
  'Stored business question in the semantic layer': 'Pregunta de negocio almacenada en la capa semántica', 'Loading governed data…': 'Cargando datos gobernados…', 'Not available in this layer': 'No disponible en esta capa',
  'Royalty Engine 1.0': 'Royalty Engine 1.0', 'statement + statementamount views': 'vistas statement + statementamount', 'Royalty Engine detail': 'Detalle de Royalty Engine', 'Suspense, Calc Errors, Income Statement': 'Suspenso, errores de cálculo, liquidación de ingresos', 'Larkspur Data workflow (demo target)': 'Flujo Larkspur Data (destino demo)',
  'Income summary (adjustments MV)': 'Resumen de ingresos (MV de ajustes)', 'adj. local net income, received %': 'ingreso neto local ajustado, % recibido', 'collectable %': '% cobrable', 'receipts & adjustments': 'cobros y ajustes',
  'Built in': 'Creado en',
  'DEMO DATA, clearly labelled: generated to mirror Royalty Engine 1.0 views until the live overview and writeback connection are validated. Writes go to the dedicated demo writeback tables ROYALTY_CLOSE_CASES / ROYALTY_CLOSE_EVENTS.': 'DATOS DEMO, claramente identificados: generados para reflejar las vistas de Royalty Engine 1.0 hasta validar el resumen en vivo y la conexión de escritura. Las escrituras van a las tablas demo dedicadas ROYALTY_CLOSE_CASES / ROYALTY_CLOSE_EVENTS.',
  'DEMO DATA, clearly labelled: generated to mirror source.income_summary_dashboard_adjustments_mv, source.song and source.song_branch_collectable. The Paid vs Collectable report is not yet available in the warehouse, so this uses demo data until Larkspur Music validates a branch and period, the percentage normalisation rules and the source-line keys. Writes go to the dedicated demo tables ROYALTY_CLAIMS / ROYALTY_RECOVERIES / ROYALTY_CLAIM_EVENTS.': 'DATOS DEMO, claramente identificados: generados para reflejar source.income_summary_dashboard_adjustments_mv, source.song y source.song_branch_collectable. El libro de migración marca el informe Pagado vs Cobrable como roto / sin datos, por lo que se usan datos demo hasta que Larkspur Music valide una sucursal y un periodo, las reglas de normalización de porcentajes y las claves de línea de origen. Las escrituras van a las tablas demo dedicadas ROYALTY_CLAIMS / ROYALTY_RECOVERIES / ROYALTY_CLAIM_EVENTS.',

  '⧉ Copy': '⧉ Copiar', 'Copying…': 'Copiando…', Copied: 'Copiadas', 'rows to the clipboard': 'filas al portapapeles', 'The browser blocked clipboard access.': 'El navegador bloqueó el acceso al portapapeles.', 'Copy failed': 'Error al copiar', 'Copy this table to the clipboard (all rows, tab-separated)': 'Copiar esta tabla al portapapeles (todas las filas, separadas por tabuladores)',
  'Exception pivot · current run · totals per branch only (USD equivalent)': 'Pivote de excepciones · ejecución actual · totales solo por sucursal (equivalente USD)', Total: 'Total', rows: 'filas', 'Expand all': 'Expandir todo', 'Collapse all': 'Contraer todo', 'Grand total': 'Total general', 'No exceptions for the current selection.': 'No hay excepciones para la selección actual.', 'Payee type': 'Tipo de beneficiario', 'Calc impact': 'Impacto de cálculo', 'Exposure ÷ earnings': 'Exposición ÷ ingresos', 'Exception pivot': 'Pivote de excepciones',
  Summary: 'Resumen', Prior: 'Anterior', 'vs prior': 'vs anterior', 'Filters & role': 'Filtros y rol', 'Needs you': 'Pendiente para usted', 'Need attention': 'Requieren atención', 'Nothing waiting for you.': 'No tiene nada pendiente.', 'Your open cases, earliest due first': 'Sus casos abiertos, por fecha límite', 'Waiting for your review': 'Pendientes de su revisión', 'Overdue cases': 'Casos vencidos',
  'Top 5 exposures · current run · tap to investigate': 'Top 5 exposiciones · ejecución actual · toque para investigar', 'Source exposure by branch (USD equiv.)': 'Exposición de origen por sucursal (equiv. USD)', 'Selected': 'Seleccionado',
  'The close at a glance for a phone: current run R-2026-10 against the prior run, what needs you, and where the exposure is. Use the header to filter by branch, run or currency.': 'El cierre de un vistazo en el móvil: ejecución actual R-2026-10 frente a la anterior, lo que requiere su atención y dónde está la exposición. Use la cabecera para filtrar por sucursal, ejecución o moneda.',
  'Recovery at a glance for a phone: the latest quarter (2026-Q3) against the prior one, what needs you, and the biggest apparent underpayments. Use the header to filter by branch, period or currency.': 'La recuperación de un vistazo en el móvil: el último trimestre (2026-T3) frente al anterior, lo que requiere su atención y los mayores aparentes pagos insuficientes. Use la cabecera para filtrar por sucursal, periodo o moneda.',
  'Underpaid lines': 'Líneas con pago insuficiente', 'Missing %': 'Falta %', 'Top 5 apparent underpayments (USD equiv.) · tap to open a claim': 'Top 5 aparentes pagos insuficientes (equiv. USD) · toque para abrir una reclamación', 'Gap (USD)': 'Brecha (USD)', 'Open claim or dismiss →': 'Abrir reclamación o descartar →',
  'Claims to confirm and submit to the payer': 'Reclamaciones por confirmar y enviar al pagador', 'Submitted claims to record recoveries against': 'Reclamaciones enviadas para registrar recuperaciones', 'Your open claims and data-quality investigations': 'Sus reclamaciones abiertas e investigaciones de calidad de datos', underpaid: 'pago insuficiente', all: 'todas',
  current: 'actual', 'As reported': 'Según reportado', 'Statement extract': 'Extracto de liquidación', 'carried forward': 'traspasado', 'still exposed': 'aún expuesto', 'source recon flag at opening': 'indicador de conciliación al abrir', 'statement + statementamount views': 'vistas statement + statementamount',
  'DEMO DATA, clearly labelled: generated to mirror Royalty Engine 1.0 views until the live overview and writeback connection are validated. Writes go to the dedicated demo writeback tables ROYALTY_CLOSE_CASES / ROYALTY_CLOSE_EVENTS. Built in': 'DATOS DEMO, claramente identificados: generados para reflejar las vistas de Royalty Engine 1.0 hasta validar el resumen en vivo y la conexión de escritura. Las escrituras van a las tablas demo dedicadas ROYALTY_CLOSE_CASES / ROYALTY_CLOSE_EVENTS. Creado en',
  'DEMO DATA, clearly labelled: generated to mirror source.income_summary_dashboard_adjustments_mv, source.song and source.song_branch_collectable. The Paid vs Collectable report is not yet available in the warehouse, so this uses demo data until Larkspur Music validates a branch and period, the percentage normalisation rules and the source-line keys. Writes go to the dedicated demo tables ROYALTY_CLAIMS / ROYALTY_RECOVERIES / ROYALTY_CLAIM_EVENTS. Built in': 'DATOS DEMO, claramente identificados: generados para reflejar source.income_summary_dashboard_adjustments_mv, source.song y source.song_branch_collectable. El libro de migración marca el informe Pagado vs Cobrable como roto / sin datos, por lo que se usan datos demo hasta que Larkspur Music valide una sucursal y un periodo, las reglas de normalización de porcentajes y las claves de línea de origen. Las escrituras van a las tablas demo dedicadas ROYALTY_CLAIMS / ROYALTY_RECOVERIES / ROYALTY_CLAIM_EVENTS. Creado en',
  'Acting as': 'Actuando como',
  'Exception queue': 'Cola de excepciones', 'Branch close scorecard': 'Cuadro de cierre por sucursal', 'Statement amounts': 'Importes de la liquidación', 'Case register': 'Registro de casos', 'Action history': 'Historial de acciones', 'Branch view': 'Vista por sucursal', 'Claim register': 'Registro de reclamaciones', 'Claim history': 'Historial de reclamaciones', 'Claim balances': 'Saldos de reclamaciones', Recoveries: 'Recuperaciones', 'Exception statements by branch and category': 'Liquidaciones con excepción por sucursal y categoría', 'Suspense items by reason': 'Partidas en suspenso por motivo', 'Calculation errors by type': 'Errores de cálculo por tipo', 'Statements needing attention': 'Liquidaciones que requieren atención',
  // ---- page intros
  'Which statements need attention before close? Current processing run R-2026-10 (October 2026) against the prior run. Amounts are local currency in the queue and USD equivalent in KPIs; the source reconciliation flag is shown as delivered by Royalty Engine 1.0.': '¿Qué liquidaciones requieren atención antes del cierre? Ejecución actual R-2026-10 (octubre de 2026) frente a la anterior. Los importes están en moneda local en la cola y en equivalente USD en los KPI; el indicador de conciliación de origen se muestra tal como lo entrega Royalty Engine 1.0.',
  'Statement amounts, source reconciliation status and supporting detail for one StatementId. Open or assign a case, choose the exception type, set a due date, add notes and evidence references, and submit it for controller review.': 'Importes de la liquidación, estado de conciliación de origen y detalle de soporte de un StatementId. Abra o asigne un caso, elija el tipo de excepción, fije una fecha límite, añada notas y referencias de evidencia y envíelo a revisión del controller.',
  'Who owns each exception, and what evidence supports sign-off? Approve the disposition, return it for more work, or approve a carry-forward with a required rationale. Approved carry-forwards stay in outstanding source exposure until the source is corrected.': '¿Quién es responsable de cada excepción y qué evidencia respalda la aprobación? Apruebe la resolución, devuélvala para más trabajo o apruebe un traspaso con justificación obligatoria. Los traspasos aprobados siguen en la exposición de origen pendiente hasta que se corrija el origen.',
  'What-if: will the run close on time? Baseline is the governed current-run position; move the levers to project the residual unreconciled statements and exposure at the close deadline. Assumptions are illustrative.': 'Simulación: ¿cerrará la ejecución a tiempo? La base es la posición gobernada de la ejecución actual; mueva los controles para proyectar las liquidaciones sin conciliar y la exposición residuales en la fecha de cierre. Supuestos ilustrativos.',
  'Stored business questions in the Larkspur Music semantic layer, each run as a native Astrato table.': 'Preguntas de negocio almacenadas en la capa semántica de Larkspur Music, cada una ejecutada como tabla nativa de Astrato.',
  'Apparent underpayments ranked by estimated gap within currency (gap = adjusted local net income ÷ received % × collectable % − income). Rows missing a received or collectable percentage go to the data-quality queue and get no estimate. Click a line to open a claim, dismiss it, or route it for investigation.': 'Aparentes pagos insuficientes ordenados por brecha estimada dentro de cada moneda (brecha = ingreso neto local ajustado ÷ % recibido × % cobrable − ingreso). Las filas sin % recibido o cobrable van a la cola de calidad de datos y no se estiman. Haga clic en una línea para abrir una reclamación, descartarla o enviarla a investigación.',
  'Open a claim with its source-line references, estimate at discovery, owner, due date and evidence; the claims owner records the confirmed amount, submission date, payer reference and next follow-up.': 'Abra una reclamación con sus referencias de línea de origen, estimación inicial, responsable, fecha límite y evidencia; el responsable registra el importe confirmado, la fecha de envío, la referencia del pagador y el próximo seguimiento.',
  'Finance records partial or full recoveries against receipt or adjustment references. A reference can be allocated only once, and only recoveries with evidence count in Finance totals. Close a claim with a reason when the remainder is waived or otherwise resolved.': 'Finanzas registra recuperaciones parciales o totales contra referencias de cobro o ajuste. Cada referencia solo se puede asignar una vez y solo las recuperaciones con evidencia cuentan en los totales de Finanzas. Cierre una reclamación con un motivo cuando el resto se condone o se resuelva de otro modo.',
  'What-if: how much of the apparent underpayment becomes cash? Baseline is the governed estimated gap and data-quality queue; assumptions are illustrative.': 'Simulación: ¿cuánto del aparente pago insuficiente se convierte en efectivo? La base es la brecha estimada gobernada y la cola de calidad de datos; supuestos ilustrativos.',

  // ---- banner fragments
  'My close:': 'Mi cierre:', 'statements in': 'liquidaciones en', for: 'para', across: 'en', 'branches ·': 'sucursales ·', branches: 'sucursales', 'need attention (': 'requieren atención (', 'unreconciled,': 'sin conciliar,', 'suspense items,': 'partidas en suspenso,', 'calc errors) ·': 'errores de cálculo) ·', 'source exposure': 'exposición de origen',
  'open cases ·': 'casos abiertos ·', 'overdue ·': 'vencidos ·', 'awaiting controller review ·': 'pendientes de revisión del controller ·', 'approved carry-forwards still exposed': 'traspasos aprobados aún expuestos',
  'My recovery:': 'Mi recuperación:', 'income lines compared': 'líneas de ingreso comparadas', 'income lines compared across': 'líneas de ingreso comparadas en', 'in': 'en', 'apparent underpayments worth': 'aparentes pagos insuficientes por', '(USD equiv.) ·': '(equiv. USD) ·', 'lines missing a percentage': 'líneas sin porcentaje',
  'claims (': 'reclamaciones (', 'open) ·': 'abiertas) ·', 'recoveries recorded · estimated gap, confirmed claim and verified recovery are kept separate': 'recuperaciones registradas · brecha estimada, reclamación confirmada y recuperación verificada se mantienen separadas',
  'Loading the close position…': 'Cargando la posición de cierre…', 'Loading the recovery position…': 'Cargando la posición de recuperación…',

  // ---- filters / fields / column labels
  'Exception category': 'Categoría de excepción', 'Exception Category': 'Categoría de excepción', 'Source reconciliation': 'Conciliación de origen', 'Reconciliation Status': 'Estado de conciliación', Statement: 'Liquidación', 'Statement Id': 'Id de liquidación', 'Case status': 'Estado del caso', Owner: 'Responsable', Status: 'Estado',
  Period: 'Periodo', Payer: 'Pagador', 'Income type': 'Tipo de ingreso', 'Income Type': 'Tipo de ingreso', 'Claim status': 'Estado de reclamación', 'Evidence verified': 'Evidencia verificada', 'Source Line Id': 'Id de línea de origen',
  'Br.': 'Suc.', Payee: 'Beneficiario', Ccy: 'Mon.', Exception: 'Excepción', 'Source recon flag': 'Indicador de conciliación', Exposure: 'Exposición', 'Recon diff': 'Dif. conciliación', Suspense: 'Suspenso', 'Calc impact': 'Impacto de cálculo', Sort: 'Ordenar',
  Statements: 'Liquidaciones', Unreconciled: 'Sin conciliar', 'Unrec. rate': 'Tasa sin conciliar', 'Unreconciled · by run': 'Sin conciliar · por ejecución', 'Exposure (USD)': 'Exposición (USD)', 'Exposure ÷ earnings': 'Exposición ÷ ingresos', 'Open cases': 'Casos abiertos', Overdue: 'Vencidos',
  '#': '#', 'Amount type': 'Tipo de importe', 'Amount (local)': 'Importe (local)', 'USD equiv.': 'Equiv. USD', 'Income source': 'Fuente de ingreso', Type: 'Tipo', Song: 'Canción', Reason: 'Motivo', Source: 'Fuente', Amount: 'Importe', Age: 'Antigüedad', Code: 'Código', Error: 'Error', Impact: 'Impacto',
  Date: 'Fecha', Case: 'Caso', Action: 'Acción', Actor: 'Actor', Actions: 'Acciones', Due: 'Vence', Observed: 'Observado', 'Carried forward': 'Traspasado', 'Outstanding source exposure': 'Exposición de origen pendiente',
  'Source line': 'Línea de origen', 'Adj. local net income': 'Ingreso neto local ajustado', 'Received %': '% recibido', 'Collectable %': '% cobrable', 'Estimated gap': 'Brecha estimada', 'Data-quality issue': 'Problema de calidad de datos', Normalisation: 'Normalización', 'Income (local)': 'Ingreso (local)',
  'Estimated gap (local)': 'Brecha estimada (local)', 'Gap USD · by quarter': 'Brecha USD · por trimestre', Lines: 'Líneas', 'Underpaid rate': 'Tasa de pago insuficiente', 'DQ lines': 'Líneas CD', Claim: 'Reclamación', 'Confirmed claim': 'Reclamación confirmada', 'Verified recovery': 'Recuperación verificada', Outstanding: 'Pendiente',
  Reference: 'Referencia', Confirmed: 'Confirmado', Waived: 'Condonado', Recovery: 'Recuperación', 'Supporting reference': 'Referencia de soporte', Verified: 'Verificado', Verifier: 'Verificador', 'Verified amount': 'Importe verificado', 'Unverified amount': 'Importe no verificado', Receipt: 'Cobro', Adjustment: 'Ajuste',
  'Statement Currency': 'Moneda de liquidación', 'Source Exposure': 'Exposición de origen', 'Reconciliation Difference': 'Diferencia de conciliación', 'Suspense Amount': 'Importe en suspenso', 'Calc Error Impact': 'Impacto de errores de cálculo', 'Source Exposure · by run': 'Exposición de origen · por ejecución', 'Write-offs': 'Castigos',
  'PvC Currency': 'Moneda PvC', 'Source Line': 'Línea de origen', 'PvC Period': 'Periodo PvC', 'Estimated Gap': 'Brecha estimada', 'Adjusted Local Net Income': 'Ingreso neto local ajustado', 'Expected Collectable Income': 'Ingreso cobrable esperado',

  // ---- KPIs and tile titles (close)
  'Statements needing attention': 'Liquidaciones que requieren atención', 'Unreconciled, suspense, calc error or write-off': 'Sin conciliar, suspenso, error de cálculo o castigo', 'Unreconciled statements': 'Liquidaciones sin conciliar', 'Source reconciliation flag = N (read-only)': 'Indicador de conciliación de origen = N (solo lectura)',
  'USD equivalent; carry-forwards stay in exposure': 'Equivalente USD; los traspasos siguen en la exposición', 'USD equivalent': 'Equivalente USD', 'Calculation errors': 'Errores de cálculo',
  'Prior run': 'Ejecución anterior', 'vs prior run': 'vs ejecución anterior', rate: 'tasa', impact: 'impacto', open: 'abiertos', closed: 'cerrados', returned: 'devueltos', overdue: 'vencidos', 'run exposure': 'exposición de la ejecución',
  'Exception queue · current run · click a statement to investigate (local currency)': 'Cola de excepciones · ejecución actual · haga clic en una liquidación para investigar (moneda local)',
  'Branch close scorecard · current run with trend across runs': 'Cuadro de cierre por sucursal · ejecución actual con tendencia entre ejecuciones',
  'Exceptions by processing run (bars) vs source exposure USD (line)': 'Excepciones por ejecución (barras) vs exposición de origen USD (línea)',
  'Exception statements by branch and category · current run': 'Liquidaciones con excepción por sucursal y categoría · ejecución actual',
  'Suspense items by reason · current run': 'Partidas en suspenso por motivo · ejecución actual', 'Calculation errors by type · current run': 'Errores de cálculo por tipo · ejecución actual',
  'Gross earnings': 'Ingresos brutos', 'Reconciliation difference': 'Diferencia de conciliación', 'Calc error impact': 'Impacto de errores de cálculo', 'Source exposure': 'Exposición de origen',
  'Statement amounts · royalty_engine_statementamount_view (grain: StatementId × Amount Type, read-only)': 'Importes de liquidación · royalty_engine_statementamount_view (granularidad: StatementId × tipo de importe, solo lectura)',
  'Suspense detail (joined on StatementId)': 'Detalle de suspenso (unido por StatementId)', 'Calculation errors detail (joined on StatementId)': 'Detalle de errores de cálculo (unido por StatementId)', 'Income statement detail (joined on StatementId)': 'Detalle de liquidación de ingresos (unido por StatementId)',
  'Case history for this statement (ROYALTY_CLOSE_EVENTS)': 'Historial de casos de esta liquidación (ROYALTY_CLOSE_EVENTS)',
  'Awaiting controller review': 'Pendiente de revisión del controller', 'Approved dispositions': 'Resoluciones aprobadas', 'Approved carry-forwards': 'Traspasos aprobados', 'Still counted in outstanding source exposure': 'Aún contabilizado en la exposición de origen pendiente',
  'Case register · who owns each exception (observed amount vs live source exposure, local currency)': 'Registro de casos · responsable de cada excepción (importe observado vs exposición de origen actual, moneda local)',
  'Approved carry-forwards · exposure still outstanding at source': 'Traspasos aprobados · exposición aún pendiente en origen', 'Cases by branch and status': 'Casos por sucursal y estado',
  'Action history · every case action (actor, timestamp, observed amount)': 'Historial de acciones · cada acción del caso (actor, fecha y hora, importe observado)', 'Review queue · submitted cases': 'Cola de revisión · casos enviados',
  'Statement (source, read-only)': 'Liquidación (origen, solo lectura)', 'Exception case': 'Caso de excepción', 'Close readiness what-if': 'Simulación de preparación del cierre',

  // ---- KPIs and tile titles (recovery)
  'Estimated gap (USD equiv.)': 'Brecha estimada (equiv. USD)', 'Apparent underpayment, 2026-Q3': 'Aparente pago insuficiente, 2026-T3', 'Apparent underpayments': 'Aparentes pagos insuficientes', 'Data-quality queue': 'Cola de calidad de datos', 'Missing received or collectable %': 'Falta % recibido o cobrable', 'Collection efficiency': 'Eficiencia de cobro',
  'vs Q2': 'vs T2', Q2: 'T2', 'all periods': 'todos los periodos', 'lines underpaid': 'líneas con pago insuficiente', lines: 'líneas',
  'Selected source line': 'Línea de origen seleccionada', 'Click a row in the opportunity queue or the data-quality queue below (or use the demo links).': 'Haga clic en una fila de la cola de oportunidades o de calidad de datos (o use los enlaces de la demo).',
  'Opportunity queue · apparent underpayments ranked by estimated gap within currency · click a line to open a claim': 'Cola de oportunidades · aparentes pagos insuficientes ordenados por brecha estimada dentro de cada moneda · haga clic en una línea para abrir una reclamación',
  'Data-quality queue · missing received or collectable % (no gap estimated) · click to route for investigation': 'Cola de calidad de datos · falta % recibido o cobrable (sin brecha estimada) · haga clic para enviar a investigación',
  'Branch view · estimated gap by currency with quarterly trend': 'Vista por sucursal · brecha estimada por moneda con tendencia trimestral', 'Underpaid lines by income type': 'Líneas con pago insuficiente por tipo de ingreso',
  'Estimated gap USD (bars) and underpaid lines (line) by quarter': 'Brecha estimada USD (barras) y líneas con pago insuficiente (línea) por trimestre', 'Estimated gap by payer (USD equiv.)': 'Brecha estimada por pagador (equiv. USD)',
  'Open claims': 'Reclamaciones abiertas', 'Estimate at discovery': 'Estimación inicial', 'Dismissed candidates': 'Candidatos descartados', 'DQ investigations': 'Investigaciones de calidad de datos', 'Claim workbench': 'Mesa de trabajo de reclamaciones', 'Owner · due': 'Responsable · vence',
  'Claim register · estimated gap, confirmed claim and verified recovery are three distinct measures (local currency)': 'Registro de reclamaciones · brecha estimada, reclamación confirmada y recuperación verificada son tres medidas distintas (moneda local)',
  'Claim history · actor and timestamp of every action': 'Historial de reclamaciones · actor y fecha y hora de cada acción', 'Estimated gap (at discovery)': 'Brecha estimada (inicial)', 'Outstanding confirmed balance': 'Saldo confirmado pendiente',
  'Confirmed claims': 'Reclamaciones confirmadas', 'Verified recovery (counts in Finance)': 'Recuperación verificada (cuenta en Finanzas)', 'Recorded, not verified (excluded)': 'Registrada, no verificada (excluida)', 'Recovery rate': 'Tasa de recuperación', 'Record recovery': 'Registrar recuperación',
  'Claim balances · confirmed − verified recovery − waived = outstanding (local currency)': 'Saldos de reclamaciones · confirmado − recuperación verificada − condonado = pendiente (moneda local)',
  'Recoveries · each linked to its claim and a unique receipt / adjustment reference': 'Recuperaciones · cada una vinculada a su reclamación y a una referencia única de cobro / ajuste', 'Claims by status': 'Reclamaciones por estado',
  'Confirmed claim vs verified recovery by payer (local currency; filter one currency)': 'Reclamación confirmada vs recuperación verificada por pagador (moneda local; filtre una moneda)', 'Recovery projection': 'Proyección de recuperación',

  // ---- forms, buttons, panels (close)
  'Pick a statement: click a row in the Close overview exception queue, or use the Statement filter above.': 'Elija una liquidación: haga clic en una fila de la cola de excepciones del Resumen del cierre o use el filtro Liquidación de arriba.',
  'No statement selected.': 'Ninguna liquidación seleccionada.', 'StatementId (verified key)': 'StatementId (clave verificada)', 'Run · period': 'Ejecución · periodo', 'Source reconciliation flag': 'Indicador de conciliación de origen', 'Reconciled (Y)': 'Conciliada (Y)', 'Unreconciled (N)': 'Sin conciliar (N)', 'Close due': 'Vence el cierre', 'Suspense · calc impact': 'Suspenso · impacto de cálculo',
  'Read-only source fields from Royalty Engine 1.0 (royalty_engine_statement_view ⋈ statementamount_view on StatementId; 7 amount rows = one per amount type). This app never writes royalty amounts or reconciliation flags.': 'Campos de origen de solo lectura de Royalty Engine 1.0 (royalty_engine_statement_view ⋈ statementamount_view por StatementId; 7 filas de importe = una por tipo de importe). Esta app nunca escribe importes de regalías ni indicadores de conciliación.',
  '1. Open': '1. Abrir', '2. Assigned': '2. Asignado', '3. Submitted for review': '3. Enviado a revisión', '4. Approved / Carry-forward': '4. Aprobado / Traspaso',
  'Exception type': 'Tipo de excepción', 'Due date': 'Fecha límite', 'Observed amount (snapshot)': 'Importe observado (instantánea)', Notes: 'Notas', 'What did you see?': '¿Qué observó?', 'Open & assign case': 'Abrir y asignar caso',
  'Proposed disposition': 'Resolución propuesta', 'Evidence references (required)': 'Referencias de evidencia (obligatorio)', 'Submit for controller review': 'Enviar a revisión del controller', 'Saves notes, evidence and disposition; status → Submitted for review.': 'Guarda notas, evidencia y resolución; estado → Enviado a revisión.',
  'Go to controller review →': 'Ir a revisión del controller →', 'Disposition:': 'Resolución:', 'Evidence:': 'Evidencia:', 'Controller:': 'Controller:', 'Proposed:': 'Propuesta:', 'Notes:': 'Notas:', owner: 'responsable', due: 'vence', observed: 'observado',
  'Carry-forward approved: the source exposure is still outstanding and remains in the overview totals until the next run corrects it.': 'Traspaso aprobado: la exposición de origen sigue pendiente y permanece en los totales del resumen hasta que la próxima ejecución la corrija.',
  'Controller rationale (required to return or carry forward)': 'Justificación del controller (obligatoria para devolver o traspasar)', 'Approve disposition': 'Aprobar resolución', 'Return for more work': 'Devolver para más trabajo', 'Approve carry-forward': 'Aprobar traspaso', 'Open statement': 'Abrir liquidación',
  'Nothing is waiting for review.': 'No hay nada pendiente de revisión.', 'source recon flag at opening:': 'indicador de conciliación al abrir:', 'recon flag': 'indicador de conciliación', 'at opening)': 'al abrir)', 'Maker–checker: you submitted this case.': 'Control de cuatro ojos: usted envió este caso.', 'Pick who you are acting as.': 'Elija en nombre de quién actúa.',
  'Selected statement': 'Liquidación seleccionada', 'from the exception queue.': 'de la cola de excepciones.', 'Investigate statement →': 'Investigar liquidación →',
  'Demo script · UK · GBP': 'Guion de demo · UK · GBP', 'Priya Shah opens': 'Priya Shah abre', '(calc error E204), assigns it and submits evidence': '(error de cálculo E204), lo asigna y envía la evidencia', 'Hannah Reeve approves the disposition': 'Hannah Reeve aprueba la resolución', '(suspense) → approved carry-forward; exposure stays outstanding': '(suspenso) → traspaso aprobado; la exposición sigue pendiente',
  'Set header to UK · GBP · R-2026-10': 'Fijar cabecera en UK · GBP · R-2026-10', 'Set header to UK · GBP': 'Fijar cabecera en UK · GBP',
  'A rationale is required to return a case or approve a carry-forward.': 'Se requiere una justificación para devolver un caso o aprobar un traspaso.', 'Evidence references are required before submitting.': 'Se requieren referencias de evidencia antes de enviar.',

  // ---- forms, buttons, panels (recovery)
  'Source line (verified key)': 'Línea de origen (clave verificada)', 'Song · writer': 'Canción · autor', 'Branch · period': 'Sucursal · periodo', 'Payer · income': 'Pagador · ingreso', 'Adjusted local net income': 'Ingreso neto local ajustado', 'Estimated gap (signed)': 'Brecha estimada (con signo)', 'not estimated': 'no estimada', missing: 'falta', Missing: 'Falta',
  'Owner (claims owner)': 'Responsable (de la reclamación)', 'Source-line references': 'Referencias de línea de origen', 'Evidence (required to open)': 'Evidencia (obligatoria para abrir)', 'Dismiss reason (only to dismiss)': 'Motivo de descarte (solo para descartar)', 'Dismiss candidate': 'Descartar candidato', 'Open claim': 'Abrir reclamación', estimate: 'estimación',
  'Income Tracking Analyst or Claims Owner. Estimate at discovery is frozen on the claim.': 'Analista de seguimiento de ingresos o responsable de reclamaciones. La estimación inicial queda fijada en la reclamación.',
  'Investigator': 'Investigador', Note: 'Nota', 'Route for data-quality investigation': 'Enviar a investigación de calidad de datos', 'Creates a “DQ investigation” record + history row; it stays out of the estimated gap.': 'Crea un registro de “investigación de calidad de datos” + fila de historial; queda fuera de la brecha estimada.',
  'Missing collectable %: no gap is estimated. Route it for investigation so the percentage can be validated before it can become a claim.': 'Falta % cobrable: no se estima brecha. Envíela a investigación para validar el porcentaje antes de que pueda convertirse en reclamación.',
  'Missing received %: no gap is estimated. Route it for investigation so the percentage can be validated before it can become a claim.': 'Falta % recibido: no se estima brecha. Envíela a investigación para validar el porcentaje antes de que pueda convertirse en reclamación.',
  'already tracks this line': 'ya sigue esta línea', 'Open in claim detail →': 'Abrir en detalle de reclamación →', 'No claims yet.': 'Aún no hay reclamaciones.', refs: 'refs', evidence: 'evidencia', 'payer ref': 'ref. pagador', submitted: 'enviado', 'next follow-up': 'próximo seguimiento',
  'Confirmed claim amount': 'Importe confirmado de la reclamación', 'Submission date': 'Fecha de envío', 'Payer reference': 'Referencia del pagador', 'Next follow-up': 'Próximo seguimiento', 'Record confirmed claim & submit to payer': 'Registrar reclamación confirmada y enviar al pagador', 'Claims Owner only.': 'Solo responsable de reclamaciones.', 'Record a recovery →': 'Registrar una recuperación →',
  'No submitted claims yet: confirm a claim first.': 'Aún no hay reclamaciones enviadas: confirme primero una reclamación.', 'no recoveries yet': 'aún sin recuperaciones', verified: 'verificada', unverified: 'no verificada', 'Amount recovered': 'Importe recuperado',
  'Receipt / adjustment reference (unallocated only)': 'Referencia de cobro / ajuste (solo no asignadas)', 'Evidence (required to count)': 'Evidencia (obligatoria para contar)', 'Remittance advice / bank line': 'Aviso de remesa / línea bancaria', 'already allocated': 'ya asignada',
  'Finance (Recovery) only. Without evidence it is recorded but excluded from Finance totals.': 'Solo Finanzas (recuperación). Sin evidencia se registra pero se excluye de los totales de Finanzas.', 'Closure reason (remainder waived or otherwise resolved)': 'Motivo de cierre (resto condonado o resuelto de otro modo)', 'Close claim': 'Cerrar reclamación', waive: 'condonar',
  'Recovered in full': 'Recuperado en su totalidad', 'Remainder waived – below materiality': 'Resto condonado – por debajo de la materialidad', 'Remainder written off – payer dispute lost': 'Resto castigado – disputa con el pagador perdida', 'Settled by future-period adjustment': 'Liquidado con ajuste en periodo futuro',
  'Payer applied a contractual cap': 'El pagador aplicó un tope contractual', 'Collectable % outdated (split changed)': '% cobrable desactualizado (cambió el reparto)', 'Income already reclaimed via adjustment': 'Ingreso ya reclamado mediante ajuste', 'Below materiality threshold': 'Por debajo del umbral de materialidad', 'Territory not controlled in period': 'Territorio no controlado en el periodo',
  'Pick a dismiss reason.': 'Elija un motivo de descarte.', 'Evidence is required to open a claim.': 'Se requiere evidencia para abrir una reclamación.', 'Confirmed amount and payer reference are required.': 'Se requieren el importe confirmado y la referencia del pagador.', 'Amount and an unallocated reference are required.': 'Se requieren un importe y una referencia no asignada.',
  'Sofia Lind opens a claim on': 'Sofia Lind abre una reclamación sobre', '(PRS, received 50% vs collectable 75%)': '(PRS, recibido 50% vs cobrable 75%)', 'Marcus Bell confirms it and submits to PRS': 'Marcus Bell la confirma y la envía a PRS', 'Grace Odum records a partial recovery against PRS-RCPT-2026-11-0183': 'Grace Odum registra una recuperación parcial contra PRS-RCPT-2026-11-0183', '(missing collectable %) → route for investigation': '(falta % cobrable) → enviar a investigación',

  // ---- simulators
  'Analysts on close': 'Analistas en el cierre', 'Cases cleared per analyst per day': 'Casos resueltos por analista y día', 'Working days to close deadline (14 Nov)': 'Días hábiles hasta el cierre (14 nov)', 'Suspense released after matching': 'Suspenso liberado tras la conciliación', 'Calc errors fixed by a re-run': 'Errores de cálculo corregidos con una re-ejecución', 'Residual approved as carry-forward': 'Residual aprobado como traspaso',
  'Exception statements today': 'Liquidaciones con excepción hoy', 'Cleared by deadline': 'Resueltas antes del plazo', capacity: 'capacidad', 'Residual at close': 'Residual al cierre', 'will miss close': 'no llegará al cierre', 'on track': 'en plazo', 'Residual source exposure': 'Exposición de origen residual', 'vs today': 'vs hoy', 'Close readiness': 'Preparación del cierre', 'carried forward (still exposed)': 'traspasado (aún expuesto)', unreconciled: 'sin conciliar', exceptions: 'excepciones',
  'Grey: source exposure today (governed, USD equivalent) · Teal: projected at the close deadline': 'Gris: exposición de origen hoy (gobernada, equivalente USD) · Verde azulado: proyectada al cierre',
  'Share of the queue worked into claims': 'Parte de la cola convertida en reclamaciones', 'Claims confirmed by the payer': 'Reclamaciones confirmadas por el pagador', 'Haircut: confirmed vs estimate': 'Recorte: confirmado vs estimado', 'Confirmed balance paid within 12 months': 'Saldo confirmado pagado en 12 meses', 'Data-quality lines fixed and eligible': 'Líneas de calidad de datos corregidas y elegibles', 'Average months to cash': 'Meses medios hasta el cobro', mo: 'meses',
  'Estimated gap (governed)': 'Brecha estimada (gobernada)', '+ DQ lines unlocked': '+ líneas CD desbloqueadas', 'lines in queue': 'líneas en cola', 'Worked into claims': 'Convertido en reclamaciones', 'of the queue': 'de la cola', haircut: 'recorte', 'Verified recovery in 12 months': 'Recuperación verificada en 12 meses', 'still outstanding': 'aún pendiente', Confirmed$: 'Confirmado',
  'Cumulative verified recovery (USD equivalent), months from today': 'Recuperación verificada acumulada (equivalente USD), meses desde hoy',

  // ---- business questions + categories
  'Close overview·': 'Resumen del cierre·', 'Cross-source': 'Entre fuentes', 'Paid vs collectable': 'Pagado vs cobrable', category: 'categoría',
  'Which statements need attention before close?': '¿Qué liquidaciones requieren atención antes del cierre?', 'How many statements are unreconciled by branch this run?': '¿Cuántas liquidaciones están sin conciliar por sucursal en esta ejecución?', 'Where is the source exposure by branch and currency?': '¿Dónde está la exposición de origen por sucursal y moneda?',
  'How has exception volume trended across processing runs?': '¿Cómo ha evolucionado el volumen de excepciones entre ejecuciones?', 'What is held in suspense and why?': '¿Qué está en suspenso y por qué?', 'Which calculation errors are blocking close?': '¿Qué errores de cálculo bloquean el cierre?',
  'Does the statement-amount grain hold (one row per statement and amount type)?': '¿Se cumple la granularidad de importes (una fila por liquidación y tipo de importe)?', 'What are the statement amounts by type?': '¿Cuáles son los importes de la liquidación por tipo?', 'Which income sources make up the statement?': '¿Qué fuentes de ingreso componen la liquidación?',
  'Who owns each exception and what is overdue?': '¿Quién es responsable de cada excepción y qué está vencido?', 'What is waiting for controller review?': '¿Qué está pendiente de revisión del controller?', 'Which carry-forwards are approved but still exposed at source?': '¿Qué traspasos están aprobados pero siguen expuestos en origen?', 'Who did what on the close cases?': '¿Quién hizo qué en los casos de cierre?',
  'Which songs look underpaid, ranked by estimated gap within currency?': '¿Qué canciones parecen pagadas de menos, ordenadas por brecha estimada dentro de cada moneda?', 'Which payers underpay most?': '¿Qué pagadores pagan menos de lo debido?', 'How is apparent underpayment trending by quarter?': '¿Cómo evoluciona el aparente pago insuficiente por trimestre?',
  'Which lines are missing a received or collectable percentage?': '¿Qué líneas no tienen % recibido o cobrable?', 'What is the estimated gap vs confirmed claim vs verified recovery?': '¿Cuál es la brecha estimada vs la reclamación confirmada vs la recuperación verificada?', 'How many claims are at each stage?': '¿Cuántas reclamaciones hay en cada etapa?', 'Who did what on the recovery claims?': '¿Quién hizo qué en las reclamaciones de recuperación?',
  'Which branches carry both close exposure and recovery opportunity?': '¿Qué sucursales tienen a la vez exposición de cierre y oportunidad de recuperación?',

  // ---- data values (rendered by native objects)
  Reconciled: 'Conciliada', 'Calc error': 'Error de cálculo', 'Unreconciled + suspense': 'Sin conciliar + suspenso', 'Write-off': 'Castigo', Clean: 'Limpia', Current: 'Actual', Prior: 'Anterior', Earlier: 'Anteriores',
  'Opening balance': 'Saldo inicial', 'Advance recoupment': 'Recuperación de anticipo', 'Withholding tax': 'Retención fiscal', Payment: 'Pago', 'Closing balance': 'Saldo final',
  Writer: 'Autor', Publisher: 'Editorial', 'Co-publisher': 'Coeditorial', Administrator: 'Administrador', Performance: 'Ejecución pública', Mechanical: 'Mecánico', Digital: 'Digital', Sync: 'Sincronización',
  'Unmatched work (no ISWC)': 'Obra sin asignar (sin ISWC)', 'Missing writer split': 'Falta el reparto de autores', 'Unidentified payee': 'Beneficiario no identificado', 'Disputed ownership': 'Titularidad en disputa', 'Territory not licensed': 'Territorio sin licencia',
  'Royalty rate not found for income type': 'No se encontró tarifa para el tipo de ingreso', 'Writer splits exceed 100%': 'El reparto de autores supera el 100%', 'FX rate missing for source currency': 'Falta tipo de cambio para la moneda de origen', 'Negative closing balance after recoupment': 'Saldo final negativo tras la recuperación', 'Duplicate income line from source': 'Línea de ingreso duplicada en origen',
  Open: 'Abierto', Assigned: 'Asignado', 'Submitted for review': 'Enviado a revisión', Returned: 'Devuelto', Approved: 'Aprobado', 'Carry-forward approved': 'Traspaso aprobado',
  'Unreconciled statement': 'Liquidación sin conciliar', 'Calculation error': 'Error de cálculo', Other: 'Otro',
  'Corrected in next processing run': 'Corregido en la próxima ejecución', 'Manual adjustment posted': 'Ajuste manual contabilizado', 'Suspense released after match': 'Suspenso liberado tras conciliar', 'Write-off approved': 'Castigo aprobado', 'Timing difference – no action': 'Diferencia temporal – sin acción', 'Carry forward to next run': 'Traspasar a la próxima ejecución',
  'Case opened': 'Caso abierto', 'Case opened & assigned': 'Caso abierto y asignado', 'Opened from exception queue': 'Abierto desde la cola de excepciones', 'Seed history': 'Historial inicial', 'Seeded case for the demo close.': 'Caso inicial para el cierre de demo.', 'Disposition approved': 'Resolución aprobada', 'Controller:': 'Controller:',
  Submitted: 'Enviada', 'Partially recovered': 'Recuperada parcialmente', Recovered: 'Recuperada', Closed: 'Cerrada', Dismissed: 'Descartada', 'DQ investigation': 'Investigación de calidad de datos', OK: 'OK',
  'Missing collectable %': 'Falta % cobrable', 'Missing received %': 'Falta % recibido', 'As reported (0–1)': 'Según reportado (0–1)', 'Scaled ÷100 (payer reports 0–100)': 'Escalado ÷100 (el pagador reporta 0–100)', Society: 'Sociedad de gestión', 'Mechanical agency': 'Agencia mecánica', 'DSP / licensee': 'DSP / licenciatario',
  'Claim opened': 'Reclamación abierta', 'Claim confirmed & submitted': 'Reclamación confirmada y enviada', 'Recovery verified': 'Recuperación verificada', 'Recovery recorded & verified': 'Recuperación registrada y verificada', 'Recovery recorded (unverified – excluded)': 'Recuperación registrada (no verificada – excluida)', 'Claim closed': 'Reclamación cerrada', 'Candidate dismissed': 'Candidato descartado', 'Routed to data-quality investigation': 'Enviada a investigación de calidad de datos', 'Opened from opportunity queue': 'Abierta desde la cola de oportunidades',
  'Larkspur Music Royalty Close & Exception Review': 'Larkspur Music · Cierre de regalías y revisión de excepciones', 'Larkspur Music Paid vs Collectable Recovery': 'Larkspur Music · Recuperación pagado vs cobrable',
};
delete ES.Confirmed$;

/** Sentences built at run time. Each returns Spanish, or undefined. */
const PATTERNS = [
  [/^Needs the (.+) role \(you are (.+)\)\.$/, (m, a, b) => `Requiere el rol ${tr(a)} (usted es ${tr(b)}).`],
  [/^(.+) has no write access to branch (\w+) \(scope: (.+)\)\.$/, (m, u, b, s) => `${u} no tiene acceso de escritura a la sucursal ${b} (ámbito: ${s}).`],
  [/^No write access to branch (\w+)\.$/, (m, b) => `Sin acceso de escritura a la sucursal ${b}.`],
  [/^(.+) has read-only access\.$/, (m, u) => `${u} tiene acceso de solo lectura.`],
  [/^Writes ROYALTY_CLOSE_CASES keyed on StatementId (\S+) \+ an action-history row\. Role: Royalty Analyst with (\w+) access\.$/, (m, s, b) => `Escribe ROYALTY_CLOSE_CASES con clave StatementId ${s} + una fila de historial. Rol: analista de regalías con acceso a ${b}.`],
  [/^Finance Controller with (\w+) access\.$/, (m, b) => `Controller financiero con acceso a ${b}.`],
  [/^✓ (.+) · saved to (.+)$/, (m, a, b) => `✓ ${tr(a) ?? a} · guardado en ${b.replace('(demo writeback target)', '(destino demo)').replace('the demo writeback tables', 'las tablas demo')}`],
  [/^(.+) · writeback unavailable here: kept in this browser \(labelled demo fallback\)$/, (m, a) => `${tr(a) ?? a} · escritura no disponible aquí: guardado en este navegador (respaldo demo identificado)`],
  [/^Acting as (.+) · (.+)$/, (m, u, r) => `Actuando como ${u} · ${tr(r)}`],
  [/^Opened (\S+) on (\S+)(?: → (.+))?$/, (m, c, s, o) => `Abierto ${c} en ${s}${o ? ` → ${o}` : ''}`],
  [/^Submitted (\S+) for review$/, (m, c) => `${c} enviado a revisión`],
  [/^(Approved|Returned|Carry-forward approved): (\S+)$/, (m, d, c) => `${tr(d)}: ${c}`],
  [/^Controller: (.+)$/, (m, d) => `Controller: ${tr(d) ?? d}`],
  [/^Status → (.+)$/, (m, s) => `Estado → ${tr(s) ?? s}`],
  [/^Confirmed (\S+) at (.+)$/, (m, c, a) => `${c} confirmada por ${a}`],
  [/^Recorded (.+) against (\S+) \((.+)\)$/, (m, a, c, r) => `Registrado ${a} contra ${c} (${r})`],
  [/^Closed (\S+) \((.+)\)$/, (m, c, r) => `${c} cerrada (${tr(r) ?? r})`],
  [/^Dismissed (\S+)$/, (m, s) => `${s} descartada`],
  [/^Routed (\S+) for data-quality investigation$/, (m, s) => `${s} enviada a investigación de calidad de datos`],
  [/^(.+) is already allocated to another recovery: duplicate allocations are blocked\.$/, (m, r) => `${r} ya está asignada a otra recuperación: se bloquean las asignaciones duplicadas.`],
  [/^Amount exceeds the receipt \((.+)\)\.$/, (m, a) => `El importe supera el cobro (${a}).`],
  [/^Open claim · estimate (.+)$/, (m, a) => `Abrir reclamación · estimación ${a}`],
  [/^Close claim · waive (.+)$/, (m, a) => `Cerrar reclamación · condonar ${a}`],
  [/^Amount recovered \((\w+)\)$/, (m, c) => `Importe recuperado (${c})`],
  [/^Confirmed claim amount \((\w+)\)$/, (m, c) => `Importe confirmado de la reclamación (${c})`],
  [/^Collectable % missing in song_branch_collectable for (.+)$/, (m, a) => `Falta % cobrable en song_branch_collectable para ${a}`],
  [/^Larkspur Music close: (.+)\?$/, (m, a) => `Larkspur Music cierre: ${bq(a)}?`],
  [/^Larkspur Music recovery: (.+)\?$/, (m, a) => `Larkspur Music recuperación: ${bq(a)}?`],
  [/^BQ · (.+)$/, (m, a) => `PN · ${tr(a) ?? a}`],
  [/^(.+) · category (.+)$/, (m, d, c) => `${d} · categoría ${tr(c) ?? c}`],
  [/^Larkspur Music (.+) \(([A-Z]{2,3}|[A-Za-zÀ-ÿ ]+)\)$/, () => undefined],
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ph = (x) => { const y = tr(cap(x)); return y ? lower(y) : x; };
/** "BQ · Larkspur Music close: how has X trended by processing run?" and the other generated question shapes. */
const bq = (a) => {
  let m;
  if ((m = a.match(/^how has (.+) trended by processing run$/))) return `cómo ha evolucionado ${ph(m[1])} por ejecución`;
  if ((m = a.match(/^how has (.+) trended by quarter$/))) return `cómo ha evolucionado ${ph(m[1])} por trimestre`;
  if ((m = a.match(/^how does (.+) compare with the prior run$/))) return `cómo se compara ${ph(m[1])} con la ejecución anterior`;
  if ((m = a.match(/^how does (.+) compare with the prior quarter$/))) return `cómo se compara ${ph(m[1])} con el trimestre anterior`;
  if ((m = a.match(/^what is (.+)$/))) return `cuál es ${ph(m[1])}`;
  return ph(a);
};
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

let current = (() => { try { return localStorage.getItem(STORAGE_KEY) || 'en'; } catch { return 'en'; } })();
const listeners = new Set();
export const lang = () => current;
export const onLanguageChange = (fn) => listeners.add(fn);

/** A piece of text that is a number, amount, date, ID or separator: never translated. */
const TOKEN = /(\s*(?:·|\||→|—|−|\+|=|÷|×|:|;|,|\/|\(|\))\s*|\b[A-Z][A-Za-z]*-[\w-]+|[-−+]?[$€£]?\d[\d.,]*%?(?:\s?(?:d|pts))?|\b[A-Z]{3}\b)/;
const split = (s) => s.split(TOKEN).filter((x) => x !== undefined && x !== '');
const exact = (s) => ES[s];
/** English → Spanish for one string, or undefined when nothing is known. */
function tr(text) {
  if (!text) return undefined;
  const hit = exact(text);
  if (hit !== undefined) return hit;
  const core = text.replace(/^[\s·|]+|[\s·|.]+$/g, '');
  if (core && core !== text && exact(core) !== undefined) return text.replace(core, exact(core));
  for (const [re, fn] of PATTERNS) { const m = text.match(re); if (m) { const out = fn(...m); if (out !== undefined) return out; } }
  const parts = split(text);
  if (parts.length < 2) return undefined;
  let changed = false;
  const out = parts.map((p) => { const t = p.trim(); const x = t && exact(t); if (x !== undefined && x !== t) { changed = true; return p.replace(t, x); } return p; });
  return changed ? out.join('') : undefined;
}
export const t = (en) => (current === 'es' ? tr(en) ?? en : en);

// ------------------------------------------------------------------ page text
const ATTRS = ['placeholder', 'title', 'aria-label'];
const textMem = new WeakMap();
const attrMem = new WeakMap();
const LEAD = /^(\s*)(.*?)(\s*)$/s;
const skip = (e) => !e || e.closest('script, style, [data-i18n-skip]');
const doText = (node) => {
  if (skip(node.parentElement)) return;
  const value = node.nodeValue;
  const mem = textMem.get(node);
  if (current === 'es') {
    if (mem && value === mem.es) return;
    const [, a, core, b] = value.match(LEAD);
    if (!core || !/[A-Za-z]/.test(core)) return;
    const es = tr(core);
    if (es === undefined) return;
    const next = `${a}${es}${b}`;
    textMem.set(node, { en: value, es: next });
    node.nodeValue = next;
  } else if (mem && value === mem.es) { node.nodeValue = mem.en; textMem.delete(node); }
};
const doAttrs = (el) => {
  if (skip(el)) return;
  let mem = attrMem.get(el);
  for (const n of ATTRS) {
    const v = el.getAttribute(n);
    if (v == null) continue;
    const seen = mem?.get(n);
    if (current === 'es') {
      if (seen && v === seen.es) continue;
      const es = tr(v.trim());
      if (es === undefined) continue;
      if (!mem) attrMem.set(el, (mem = new Map()));
      mem.set(n, { en: v, es });
      el.setAttribute(n, es);
    } else if (seen && v === seen.es) { el.setAttribute(n, seen.en); mem.delete(n); }
  }
};
const walk = (root) => {
  if (root.nodeType === Node.TEXT_NODE) return doText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) n.nodeType === Node.TEXT_NODE ? doText(n) : doAttrs(n);
};
let baseTitle = document.title;
const applyAll = () => { document.documentElement.lang = current; walk(document.body); document.title = current === 'es' ? tr(baseTitle) ?? baseTitle : baseTitle; };

/** Start translating; call once after the shell renders. Returns a <select> for the header. */
export const startTranslation = () => {
  baseTitle = document.title;
  new MutationObserver((records) => {
    if (current !== 'es') return;
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doAttrs(r.target);
      else r.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  applyAll();
};
export const setLanguage = (id) => {
  if (id === current) return;
  current = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private window */ }
  applyAll();
  for (const fn of listeners) fn(id);
};
export const languageSelect = (el) => {
  const s = el('select', { 'data-i18n-skip': '', title: 'Language / Idioma' }, LANGUAGES.map((l) => el('option', { value: l.id, text: l.label })));
  s.value = current;
  s.onchange = () => setLanguage(s.value);
  return s;
};
window.__tr = tr;
