# Estado de implementación de Tenda

Última actualización: 2026-08-26

## Fuentes y prioridad

1. Instrucciones explícitas del usuario.
2. `Tenda_03_Plan_de_Desarrollo_Ejecutable.pdf`.
3. `Tenda_02_Especificacion_Funcional_y_Vistas.pdf`.
4. `Tenda_Capacidades_y_Herramientas.pdf`.

Los tres documentos fueron revisados antes de iniciar la implementación. El
Documento 03 resuelve las diferencias de stack: el MVP usa Django ASGI con
Graphene, React/Vite y Expo; la Etapa 4 no se implementa y solo se anuncia como
“Próximamente”.

## Baseline

- Estado inicial: directorio con tres documentos PDF, sin código ni Git.
- Repositorio local inicializado, sin commits.
- Python objetivo: 3.12.
- Gestor Python: uv, con `uv.lock`.
- Django objetivo: rama LTS 5.2.
- Node objetivo: 20.19.4 o superior; CI usa Node 22.
- Gestor JavaScript: pnpm 10, fijado mediante Corepack y `pnpm-lock.yaml`.
- PostgreSQL: 17.
- Redis: 7.
- Moneda MVP: CLP entero.
- Zona horaria seed: `America/Santiago`.
- Reserva de stock: 8 horas.
- Agente: `AGENT_FEATURE_STATUS=coming_soon`, sin modelos, endpoints, migraciones,
  colas ni workers de IA.

## Paquetes

| Paquete   | Estado           | Nota                                                     |
| --------- | ---------------- | -------------------------------------------------------- |
| P0        | Completado       | Documentos y directorio inspeccionados; baseline fijado. |
| T0.1      | Completado       | Bootstrap reproducible y smoke local aprobados.          |
| T0.2–T0.8 | Completado       | Fundación transversal; gate de Etapa 0 aprobado.         |
| T1.1–T1.5 | Completado       | Catálogo, ledger, contrato e inventario web y mobile.    |
| T1.6–T1.8 | Completado       | Media/jobs, alertas/auditoría y agente desactivado.      |
| T2.1–T2.8 | Completado       | Ventas, checkout público, pagos y balance.               |
| T3.1–T3.6 | Completado       | Despacho, tickets, cadencias e incidencias (histórico).  |
| T3.7      | Completado       | E2E Playwright, axe, Maestro, docs de go-live.           |
| T3.8      | Completado       | Despachos simplificados a «registrar y notificar».       |
| T4        | Fuera de alcance | Requiere autorización post-MVP. No hay código de IA.     |

## Invariantes

- Toda entidad de negocio privada se aísla por Tienda e inventario.
- Los movimientos de stock son inmutables y actualizan el balance en una
  transacción con lock.
- `available = on_hand - reserved` y nunca puede ser negativo.
- Reservar, liberar y consumir son operaciones idempotentes y exactamente una vez.
- Un retorno de navegador no confirma un pago.
- Los efectos externos salen de una outbox después del commit.
- Redis no es fuente durable de estado de negocio.
- El precio y costo de una venta se conservan como snapshots.
- Un reembolso no repone stock automáticamente.
- Un pedido impago no puede despacharse.
- Registrar el despacho o la entrega es un paso único y terminal; el correo al
  comprador sale por outbox después del commit y no se repite en reintentos.

## Checkpoints

### P0 — Preflight

- No existían `AGENTS.md`, código, migraciones, pruebas, configuración ni activos.
- Se inicializó Git sin crear commits.
- Se adoptaron defaults seguros y reversibles para poder ejecutar T0.1.
- Próximo paquete habilitado: T0.1.

### T0.1 — Bootstrap reproducible

- Monorepo pnpm creado con web React/Vite, mobile Expo Router y cliente GraphQL
  generado.
- Backend Django ASGI creado con nueve apps modulares base, Graphene, Celery,
  healthchecks y settings Local/Dev/Prod.
- Lockfiles: `pnpm-lock.yaml` y `backend/uv.lock`.
- Infraestructura: PostgreSQL 17, Redis 7, backend, web, worker, beat y Nginx;
  PostgreSQL y Redis no publican puertos.
- CI, Dockerfiles, overlays Compose, `.env.example`, README y ADR 0001 creados.
- No existe app, modelo, endpoint, migración, worker o cola de agente.

Validación ejecutada:

- `manage.py check` y migraciones sin drift: correcto.
- pytest: 4 pruebas aprobadas.
- Ruff y mypy estricto: correctos.
- lint y typecheck web/mobile/cliente: correctos.
- GraphQL Code Generator: correcto.
- builds TypeScript y dos imágenes Docker: correctos.
- Compose Local/Dev/Prod: válido.
- Stack Dev: siete servicios activos; backend, web, PostgreSQL y Redis healthy.
- Readiness: PostgreSQL y Redis correctos.
- Smoke GraphQL `{ health }`: correcto.

Decisiones/deuda:

- El host disponible usa Node 20.19.2, dos revisiones por debajo del mínimo de
  React Native; las verificaciones JavaScript se ejecutaron ignorando únicamente
  ese check. La imagen y CI usan una versión compatible.
- Los proveedores externos permanecen sin credenciales y se implementarán con
  adapters fake deterministas.
- Próximo paquete habilitado: T0.2, identidad, organizaciones y permisos.

### T0.2 — Identidad, organizaciones y permisos

- Usuario por email, perfil, Tienda, membresía, inventario activo y
  sesiones mobile revocables implementados con identificadores públicos UUID.
- Roles `owner`, `operator` y `support_admin`; permisos explícitos para finanzas,
  miembros y configuración sensible.
- Registro transaccional crea Owner, Tienda e inventario principal.
- Login web con cookie HttpOnly/CSRF y mobile con bearer token hasheado en base
  de datos; recuperación revoca sesiones anteriores.
- Verificación de email y recuperación usan tokens hasheados, de un uso y con
  expiración. Las respuestas públicas no permiten enumerar cuentas.
- Rate limiting de autenticación durable en PostgreSQL.
- Google OIDC dispone de adapter fake determinista; es el único proveedor
  social (el scaffold LinkedIn se retiró). No se almacenan ni registran tokens
  sin hash.
- Selectores tenant-safe ocultan IDs de otra Tienda.
- REST versionado, contrato GraphQL de identidad/Tienda, cliente generado,
  Django Admin, pantallas web y flujos Expo implementados.

Validación ejecutada:

- 15 pruebas backend aprobadas; 11 cubren identidad, CSRF, OIDC, revocación,
  rate limit, roles, permisos, GraphQL y aislamiento tenant.
- Django check y migraciones sin drift: correctos.
- Ruff, mypy estricto, lint y typecheck web/mobile/cliente: correctos.
- Build web y cliente GraphQL: correcto.
- Stack Dev recreado con PostgreSQL real; siete servicios sanos.
- Smoke CSRF + registro Owner y rutas web: correcto.

Decisiones/deuda:

- El proveedor de entrega de auth es fake en esta etapa; T0.5/T0.6 lo conectan
  a outbox y Brevo.
- Próximo paquete habilitado: T0.3, contrato GraphQL/REST, errores,
  idempotencia y límites de consulta.

### T0.3 — GraphQL, REST, errores e idempotencia

- `/graphql/` usa una vista propia con presupuesto de profundidad y cantidad de
  campos antes de ejecutar resolvers.
- REST y GraphQL devuelven códigos estables, errores de campo, `retryable` y
  correlation ID.
- El schema Django es canónico; `pnpm codegen` lo exporta y regenera los tipos.
  CI falla si schema o cliente presentan drift.
- `IdempotencyKey` queda aislada por Tienda, scope y clave; conserva hash
  de request y respuesta estable, rechaza reutilización con payload distinto y
  evita ejecutar dos veces el comando.
- La migración, Admin de solo lectura y wrapper transaccional común quedaron
  listos para las mutations críticas de T1–T3.

Validación ejecutada:

- Pruebas de replay idempotente, payload conflictivo, límite GraphQL y envelope
  REST: 3 aprobadas.
- El límite GraphQL conserva correlation ID y código estable.
- Schema exportado, Codegen y typecheck: correctos.
- Django check, migraciones sin drift, Ruff y mypy estricto: correctos.

Próximo paquete habilitado: T0.4, shell web/mobile y componentes de interfaz.

### T0.4 — Shell web/mobile y superficie pública

- Web autenticada con sidebar contraíble, header contextual y destinos Inicio,
  Inventario, Ventas, Despachos, Balances y Más. En viewport pequeño pasa a
  navegación inferior y oculta Balances en Más.
- Mobile usa Expo Tabs con Inicio, Inventario, Ventas, Despachos y Más; cada tab
  conserva su stack. Balances vive dentro de Más y respeta `view_financials`.
- Dashboard orientado a atención, sin métricas ficticias de módulos aún no
  implementados.
- Componentes base: SearchField, FilterPanel, StatusChip, EmptyState,
  FormErrorSummary, UploadField, Timeline y ConnectivityBanner.
- Landing, autenticación y contacto permanecen fuera del shell.
- Contacto público funcional con CSRF, rate limit, Turnstile real por adapter o
  fake local explícito, validación y almacenamiento durable.
- Controles del asistente permanecen desactivados y rotulados “Próximamente”.

Validación ejecutada:

- Typecheck y lint web/mobile: correctos.
- Pruebas de CSRF + Turnstile + persistencia de contacto: aprobadas.
- Ruff y mypy estricto: correctos.
- Targets interactivos y estados loading/error/permission implementados.

Próximo paquete habilitado: T0.5, auditoría, outbox y jobs durables.

### T0.5 — Auditoría, outbox y jobs

- `AuditEvent` append-only con actor, Tienda, objeto, outcome, metadata
  minimizada y correlation ID. Campos sensibles se redactan.
- `OutboxEvent` transaccional con deduplicación, lock, retry exponencial acotado,
  máximo de intentos y dead-letter auditable.
- Tokens de verificación y recuperación viajan cifrados dentro de la outbox; el
  valor sin hash no queda en tablas ni logs.
- `Notification` y `NotificationDelivery` conservan estado de entrega.
- Los emails de identidad ya salen exclusivamente después del commit por outbox.
- Celery usa colas `default`, `email` e `imports`; Beat usa agenda durable en
  PostgreSQL mediante `django-celery-beat`.
- Parámetros operacionales y feature flags soportan defaults globales y override
  por Tienda.
- Worker y Beat esperan que backend termine migraciones antes de iniciar.

Validación ejecutada:

- Suite backend: 23 pruebas aprobadas.
- Pruebas de cifrado, entrega, auditoría inmutable, retry/dead-letter y overrides:
  aprobadas.
- Stack Dev sano; Beat programó `dispatch-outbox` y worker procesó un registro
  real en PostgreSQL (`succeeded`, un intento, notificación `sent`).
- Check de seguridad Prod con valores válidos: sin observaciones.
- Ruff, mypy estricto, migraciones sin drift y build web: correctos.

Próximo paquete habilitado: T0.6, integraciones externas y adapters fake.

### T0.6 — Integraciones externas y fakes

- Storage privado con contrato R2/S3, URLs firmadas de carga/descarga, TTL,
  claves aisladas por Tienda y fake determinista.
- Ciclo durable `prepare → upload → complete`; formato, tamaño y metadata se
  validan antes de marcar un archivo `ready`. No se persisten URLs públicas.
- Email usa boundary genérico, fake idempotente y adapter Brevo como transporte.
  Las plantillas viven en la app (`email_templates.py`). La outbox selecciona
  fake o Brevo por configuración.
- Pagos usan contrato Decimal-safe, fake determinista y adapter Mercado Pago
  para preferences, consulta y verificación HMAC de webhooks.
- Inbox de webhooks conserva cuerpo raw, headers seguros y payload normalizado,
  valida firma antes de persistir y deduplica por evento de proveedor.
- La firma Mercado Pago sigue el manifest oficial, convierte `data.id` a
  minúsculas y omite segmentos ausentes.
- Turnstile mantiene adapter real y fake local explícito; Google OIDC fake
  sigue vigente.
- Credenciales y selección de proveedores quedan exclusivamente en ambiente.

Validación ejecutada:

- 15 pruebas de integración/identidad aprobadas.
- Contratos fake deterministas, aislamiento R2, descarga expirable, firma real
  Mercado Pago, webhook inválido y replay idempotente: aprobados.
- Ruff, mypy estricto, Django check y migraciones sin drift: correctos.

Próximo paquete habilitado: T0.7, adaptador de pagos y conexión comercial.

Corrección de numeración: según el Documento 03, T0.7 corresponde al adaptador
de pagos y la conexión comercial del vendedor, y T0.8 a seguridad,
observabilidad, CI/CD y recuperación. El trabajo transversal de seguridad
iniciado antes se consolidó dentro de T0.8.

### T0.7 — Pagos y conexión comercial

- `SellerPaymentConnection` es única por Tienda y proveedor, con estados
  `pending`, `connected`, `disconnected` y `error`.
- El flujo OAuth vive en servicios: iniciar, completar y desconectar. El
  callback REST es un adaptador delgado que redirige a configuración con un
  resultado legible y sin filtrar detalle del proveedor.
- `PaymentOAuthState` guarda solo el digest del estado, expira, se consume una
  sola vez bajo lock y se invalida al reiniciar o desconectar.
- Los tokens del vendedor se cifran con la clave de credenciales. El contrato
  GraphQL expone estado, cuenta y scopes; nunca tokens. Desconectar borra el
  material cifrado.
- Solo `manage_sensitive_configuration` puede leer o gestionar la conexión;
  Operator recibe permiso denegado. Tenda nunca solicita credenciales del
  vendedor.
- `commission_mode`, `commission_rate` y `commission_minimum` son parámetros
  operacionales con override por Tienda; el flag de comisión cero queda
  apagado hasta validarse con dinero real.
- El adapter agrega URL de autorización e intercambio de código; el fake es
  determinista y no requiere credenciales. El checkout de negocio corresponde
  a T2.6 y no se adelanta.

Validación ejecutada:

- Pruebas de estado de un uso, replay rechazado, cifrado de tokens, contrato
  GraphQL sin secretos, override de comisión y denegación a Operator:
  aprobadas.
- Smoke iniciar → callback → desconectar sobre PostgreSQL real del stack Dev:
  correcto, con auditoría de inicio, término y desconexión.
- Migraciones sin drift, codegen sin divergencia, Ruff y mypy estricto:
  correctos.

Decisiones/deuda:

- Sin credenciales reales, quedan pendientes como gates externos el smoke en
  sandbox y un pago real en Chile antes de Producción.
- La renovación de token y la revocación remota se implementan junto al
  checkout en T2.6, cuando exista un pedido que las ejercite.

Próximo paquete habilitado: T0.8, seguridad, observabilidad, CI/CD y
recuperación.

### T0.8 — Seguridad, observabilidad, CI/CD y recuperación

- Logs JSON con correlation ID propagado por contexto; el formateador redacta
  correo, tokens, cookies y parámetros sensibles. Sentry usa el mismo scrubber.
- Headers de seguridad en Django y Nginx: CSP, Permissions-Policy,
  Referrer-Policy, X-Frame-Options y nosniff.
- Producción no arranca si faltan orígenes, claves de cifrado, red permitida de
  Admin o prefijo privado de Admin. `check --deploy` corre en CI.
- Django Admin queda fuera de rutas conocidas, restringido por red de
  administración, sin caché y con límite de intentos durable en PostgreSQL.
- CI agrega auditoría de dependencias JavaScript y Python, escaneo de código,
  configuración y secretos, validación de Compose de operación y lint de los
  scripts operativos.
- Las imágenes de backend, web y backup se publican por SHA, con SBOM y
  provenance, solo tras CI en verde y escaneo de la imagen.
- El despliegue exige imagen inmutable, serializa ejecuciones, respalda antes
  de migrar, aplica migraciones como tarea one-shot, verifica readiness y
  revierte al último set bueno si falla.
- El respaldo se cifra en el host antes de salir y se sube a almacenamiento
  privado con checksum. El restore verifica checksum y exige doble
  confirmación con el nombre exacto de la base.
- Monitoreo externo, métricas y gestión de contenedores quedan fijados por
  versión y enlazados solo a la interfaz de la red privada.

Validación ejecutada:

- Suite backend completa: 37 pruebas aprobadas, incluidas redacción de logs,
  headers, cifrado rotable, Admin oculto fuera de red y rate limit de Admin.
- `check --deploy` con valores de Producción: sin observaciones.
- Compose Local, Dev, Producción, operación y agentes: válidos.
- ShellCheck sobre respaldo, restauración y despliegue: sin observaciones.
- Imagen de respaldo construida; respaldo y restauración rechazan
  configuración incompleta con código de uso.
- Stack Dev reconstruido: siete servicios activos y sanos; readiness y
  `{ health }` correctos.
- Auditoría de dependencias productivas JavaScript y Python: sin
  vulnerabilidades conocidas.
- Formato, lint, typecheck, build y codegen sin drift: correctos.

Decisiones/deuda:

- El ensayo de restauración está automatizado y documentado, pero aún no se
  ejecutó contra infraestructura real. Queda como gate obligatorio previo al
  go-live, junto con T3.7.
- La detección de caída desde el host de operación requiere los dos servidores
  y la red privada; el procedimiento está listo y pendiente de ejecución.

## Gate de salida de Etapa 0

- Local y Dev levantan desde checkout limpio; health y readiness responden y
  las migraciones son repetibles y sin drift.
- Registro, login, verificación, recuperación y Google fake funcionan.
- Aislamiento por Tienda y matriz de permisos verificados
  automáticamente.
- GraphQL y REST comparten envelope de error, idempotencia y correlation ID; el
  cliente generado no presenta drift.
- Carga de archivos y correo completan el ciclo por outbox sin duplicación.
- Shell web y mobile con estados de carga, error y permiso.
- CI en verde; secretos fuera de Git; sin servicio, cola ni migración de
  agente.

Gates externos pendientes y no simulables: smoke real de almacenamiento y
correo, sandbox y pago real de Mercado Pago, detección de caída desde el host
de operación y ensayo de restauración sobre infraestructura.

Próxima etapa habilitada: Etapa 1, inventario, comenzando por T1.1.

### T1.1 — Catálogo y columnas dinámicas

- `CustomFieldDefinition` define columnas propias por inventario con key estable,
  etiqueta, tipo, opciones, obligatoriedad, visibilidad, filtrabilidad y orden.
- El máximo es de 15 columnas activas por inventario; desactivar libera cupo y
  conserva los valores ya guardados. Reactivar vuelve a validar el límite.
- `Product` guarda nombre, estado de catálogo, precios de referencia en CLP,
  atributos dinámicos validados contra el esquema y archivado con marca de
  tiempo. El nombre es único, sin distinguir mayúsculas, entre productos no
  archivados.
- Los precios distinguen “sin definir” de cero: `null` y `0` se guardan y
  muestran distinto, y se rechazan decimales o montos negativos.
- Solo Owner y Support Admin administran el esquema; el permiso
  `manage_inventory_schema` viaja en el contrato de identidad.
- Declarar una columna obligatoria con productos existentes exige un valor de
  relleno; el backfill queda auditado con el número de productos afectados.

### T1.2 — Ledger de stock y concurrencia

- `StockMovement` es append-only: registra tipo, cantidad firmada, saldo
  posterior, motivo, actor, referencia y correlation ID. Editar o borrar está
  bloqueado en el modelo y en Admin.
- `StockBalance` mantiene `on_hand` y `reserved` con restricciones que impiden
  valores negativos y reservas mayores al stock disponible.
- Cada movimiento se aplica dentro de una transacción con lock de fila, de modo
  que dos salidas simultáneas no sobrevenden ni pierden actualizaciones.
- Crear producto con cantidad inicial genera producto, balance y movimiento en
  una sola transacción; editar un producto nunca reescribe stock.
- Mermas y correcciones exigen motivo; las correcciones aceptan signo negativo.
- `createProduct` y `recordStockMovement` son idempotentes por clave: reenviar
  la misma solicitud devuelve el resultado original sin duplicar.
- Archivar exige que no haya reservas activas, bloquea nuevos movimientos y
  conserva el historial; reactivar lo devuelve al catálogo.

### T1.3 — Selectores y contrato GraphQL

- Selectores tenant-safe proyectan disponibilidad (`on_hand`, `reserved`,
  `available`) y resuelven filtros por búsqueda, estado de catálogo, estado de
  stock y atributos dinámicos declarados como filtrables.
- Paginación por cursor keyset reutilizable, con orden acotado a columnas
  indexadas o proyectadas y cursores opacos.
- El contrato expone `products`, `product`, `productStockBreakdown`,
  `stockMovements`, `inventorySchema` e `inventoryDashboard`, además de las
  mutations de catálogo, esquema y stock.
- `productOrders` y `productShipments` existen vacíos y rotulados con la etapa
  que los habilita, para no inventar ceros engañosos en la interfaz.
- Los montos viajan como texto para evitar el desbordamiento de `Int` en CLP.
- Consultar un producto de otra Tienda responde no encontrado.

### T1.4 — Inventario web

- `/app/inventario` usa TanStack Table server-side: búsqueda, chips de estado y
  orden viven en la URL, y cambiar un filtro descarta el cursor porque las
  páginas keyset no son comparables.
- Cada producto aparece una vez con disponibilidad, reservas, total, precios de
  referencia y las columnas dinámicas visibles. Mostrar u ocultar columnas es
  preferencia personal y no altera el esquema global.
- El chevron expande el desglose con `aria-expanded`, carga solo al abrirse y
  muestra primero la disponibilidad agregada.
- Formulario de creación y edición con datos básicos, precios, campos dinámicos
  y sección de fotos rotulada. “Agregar columna” abre el gestor sin salir del
  formulario y conserva el borrador por key.
- Ajustar stock ocurre en un modal con saldo antes y después, motivo obligatorio
  para merma y corrección, y confirmación explícita.
- Archivar pide confirmación, advierte sobre reservas activas y no borra
  movimientos. El detalle muestra resumen, atributos, desglose, movimientos y
  secciones vacías rotuladas de ventas y despachos.
- El botón “Agregar con asistente” permanece deshabilitado con explicación
  textual, sin navegación ni petición asociada.

Validación ejecutada:

- Suite backend completa: 60 pruebas aprobadas y 1 omitida (concurrencia real
  sobre PostgreSQL).
- Pruebas web nuevas con Vitest y Testing Library: 11 aprobadas, incluidas
  carga, vacío inicial, cero resultados, error reintentable, permiso de esquema,
  asistente desactivado sin peticiones, expansión perezosa, doble envío que no
  duplica y archivado con confirmación.
- Ruff, mypy estricto, lint y typecheck de todos los paquetes: correctos.
- Codegen sin divergencia y build web: correctos.

Decisiones/deuda:

- `pnpm schema:export` ahora formatea el schema exportado; antes el archivo
  generado y el verificador de formato pedían resultados distintos.
- Vitest 3 trae tipos de Vite 7 mientras la aplicación compila con Vite 8, por
  lo que `vitest.config.ts` queda fuera del typecheck. Se resuelve al subir a
  una versión de Vitest compatible con Vite 8.
- La carga de fotos permaneció rotulada hasta T1.6; el contrato del formulario
  no anticipó un upload simulado.

### T1.5 — Inventario mobile

- El teléfono consulta el mismo contrato GraphQL que la web: los documentos
  generados viajan con bearer token y `X-Tenda-Client: mobile`, sin el
  handshake CSRF que solo aplica al navegador.
- `/(tabs)/inventario` es una lista de tarjetas con nombre, precio de
  referencia, total y chips de disponibilidad, reservas y proceso. No replica
  las 15 columnas ni depende de scroll horizontal.
- Búsqueda con retardo, chips de disponibilidad siempre visibles y hoja de
  filtros con estado de catálogo y orden. Pull to refresh y paginación por
  cursor al llegar al final.
- El chevron expande el desglose en la misma tarjeta, anuncia su estado y pide
  las reservas solo al abrirse.
- Detalle en stack con resumen, atributos, disponibilidad, movimientos y las
  secciones rotuladas de ventas y despachos. Editar, ajustar, archivar y
  reactivar respetan las mismas reglas que la web; archivar avisa cuando hay
  reservas activas.
- Crear y editar ocurre en una sola columna, con teclado numérico para montos y
  cantidades, foco automático al primer error y confirmación al salir con
  cambios sin guardar.
- “Agregar columna” abre una hoja que conserva el borrador: al guardar la
  definición el formulario se reconstruye y solo agrega la key nueva.
- Ajustar stock usa una hoja con saldo antes y después, motivo obligatorio en
  merma y corrección, bloqueo de saldos negativos y clave de idempotencia por
  apertura.
- Sin red la mutación falla explícitamente con `NETWORK_UNAVAILABLE`, el
  borrador permanece en pantalla y no se encola nada: la clave de idempotencia
  se conserva porque el servidor nunca recibió el intento.
- El resumen de inventario reemplaza el marcador del dashboard mobile con
  productos, disponible, reservado, sin unidades y actividad reciente.
- “Usar asistente con foto” queda visible y deshabilitado, con explicación
  textual accesible, sin navegación ni petición asociada.

Validación ejecutada:

- Suite mobile nueva con Jest, jest-expo y Testing Library: 11 aprobadas, entre
  ellas tarjetas sin tabla, expansión perezosa con estado anunciado, vacío
  inicial frente a cero resultados, validaciones de nombre y monto entero,
  pérdida de red que conserva el borrador sin encolar, columna creada sin
  perder lo escrito, asistente desactivado sin peticiones, saldo antes/después,
  bloqueo de saldo negativo e idempotencia del ajuste.
- Suite web con Vitest: 11 aprobadas.
- Typecheck, lint y formato de todos los paquetes: correctos.

Decisiones/deuda:

- Jest se fija en 29 porque `jest-expo` 57 depende de `jest-environment-jsdom`
  29; con Jest 30 el entorno queda incompatible.
- El patrón de transformación apunta a `node_modules/.pnpm/...` porque el
  preset de Expo asume la disposición plana de npm y, sin ese ajuste, React
  Native llega sin transpilar.
- El cliente generado se resuelve desde su código fuente en las pruebas para no
  depender de `pnpm build` previo.
- La cámara y la galería se implementan en T1.6 sobre el mismo ciclo privado de
  upload usado por la web; nunca se conectan al control de asistente.

### T1.6 — Fotos, importación y exportación

- `ProductMediaAttachment` conserva la galería privada y `Product.primary_image`
  la foto principal. Attach, cambio de principal y remove validan tenant,
  propósito, estado `ready`, archivo de producto y límite de 10 imágenes.
- El ciclo `prepare → PUT → complete` sigue usando URL presignada en R2. El
  proveedor fake incorpora un PUT autenticado solo para Local/Dev, por lo que
  el flujo real puede probarse sin publicar archivos.
- Web y mobile muestran galería, progreso, reintento, selección de principal y
  eliminación confirmada. Mobile usa `expo-image-picker`; esta foto es de
  catálogo y no habilita análisis ni una petición de agente.
- `InventoryImport` persiste archivo, encabezados, muestra, mapeo, errores por
  fila, contadores, progreso y `error_code`. El wizard web carga CSV/XLSX,
  mapea campos base y dinámicos, previsualiza errores y confirma antes de
  encolar.
- Cada fila se normaliza contra el mismo esquema dinámico y usa una clave
  determinística `import:<job>:row:<fila>`. Cada fila corre en su propia
  transacción: una inválida no revierte las válidas y un reintento no duplica
  producto ni movimiento inicial.
- El reporte CSV identifica fila, código y causa. Keys dinámicas no declaradas
  son rechazadas antes de confirmar y también al ejecutar la tarea.
- `InventoryExport` aplica los filtros del catálogo, genera CSV o XLSX privado,
  expone estado/progreso durable y entrega una URL firmada solo durante la
  vigencia de 24 horas. Inicio y reintento conservan el mismo job idempotente.
- Análisis/import/export se enrutan a la cola Celery `imports`; la UI usa polling
  con backoff de 1 a 8 segundos. Mobile consulta importaciones, exportaciones,
  resultados y descargas, pero no ofrece carga o mapeo masivo.

### T1.7 — Alertas, auditoría y ciclo de vida

- `Inventory.low_stock_threshold` define el umbral general y
  `Product.low_stock_threshold` permite una excepción o heredar el general.
  Ambos se configuran desde inventario/detalle web.
- `InventoryAlert` materializa stock bajo o agotado con una restricción de una
  alerta activa por producto/tipo. Cada cambio de saldo o umbral actualiza,
  resuelve o abre la transición; consultar dashboard/feed no escribe ni envía.
- Dashboard web y mobile muestran conteos y feed enlazado al producto. Una
  migración de datos materializa alertas de productos ya existentes.
- Creación, ajuste, columnas, archivo/reactivación, media, umbrales,
  importación y exportación dejan `AuditEvent` minimizado. Stock, alertas,
  media y jobs tienen selectores tenant-safe y vistas de soporte read-only en
  Django Admin.
- Archivar sigue siendo la única baja del catálogo: no existe delete de
  producto y las referencias/movimientos permanecen.

### T1.8 — Controles de agente desactivados

- Web conserva «Agregar con asistente» y mobile «Usar asistente con foto»
  visibles, nativamente disabled y con explicación textual accesible.
- `AGENT_FEATURE_STATUS` acepta únicamente `disabled` o `coming_soon`; ninguna
  ruta V4 se registra para cualquiera de ambos valores.
- No existe `apps/agent`, `AgentRun`, operación `agent*`, cola/worker `agent`,
  proveedor de IA ni `pgvector`. La carga de fotos de catálogo es un flujo
  separado y nunca llama al control deshabilitado.
- Las pruebas web/mobile verifican ausencia de navegación y petición en los
  controles, además de fotos, import/export y estados operativos.

Validación ejecutada:

- Backend: 69 pruebas aprobadas y 1 omitida; incluye CSV/XLSX, error parcial,
  reintento idempotente, aislamiento tenant, media privada y deduplicación de
  alertas.
- Web: 14 pruebas aprobadas; incluye wizard, filtros de exportación, upload de
  foto y controles de agente desactivados.
- Mobile: 13 pruebas aprobadas; incluye foto principal privada y el control de
  asistente sin acción.
- Ruff, mypy estricto, migraciones, codegen, typecheck y builds de los tres
  paquetes quedan correctos.

### T2 — Ventas, checkout público y balance comercial

- Pedidos con reserva de 8 horas, snapshots de precio/costo, enlace público
  `/p/<token>` y checkout sin cuenta. Un retorno de Mercado Pago no confirma
  el pago; solo el webhook o una validación/manual del vendedor lo hace.
- GraphQL de ventas cubre dashboard, listado, detalle, checkout público,
  balance, desglose y cola `reconciliationIssues`. Las mutations seller llevan
  clave de idempotencia; `setBuyerDetails` usa Turnstile y rate limit.
- Web y mobile mapean el contrato real a la UI: `allowedActions` como booleans,
  comprador `name` → `fullName`, balance `confirmedGross`/`knownCogs` → ventas
  brutas y costo conocido. El checkout público permanece solo en web.
- Owner conecta o desconecta Mercado Pago. Transferencia y efectivo aceptan
  comprobante privado o registro manual. Un reembolso no repone stock.
- Balances exige `view_financials`. Costos nulos no se interpretan como cero y
  el margen queda marcado incompleto. Conciliaciones abiertas no se ocultan.

Validación ejecutada:

- Backend ventas: 19 pruebas aprobadas y 2 omitidas (concurrencia PostgreSQL).
- Web Vitest: 24 aprobadas, incluye nueva venta, detalle, balances y checkout.
- Mobile Jest: 20 aprobadas, incluye listado, creación, detalle y balances.
- Ruff, mypy estricto de `apps/sales`, typecheck web/mobile/cliente: correctos.

Decisiones/deuda:

- El schema GraphQL no agrupa el desglose; la UI etiqueta filas por período,
  producto, método o estado a partir de las mismas filas.
- Node local sigue en 20.19.2; codegen se ejecutó con el binario del paquete.

Continuación: T3 Despachos, más abajo.

### T3.1 — Modelo y máquina de estados de despacho

- `Shipment` nace solo cuando la venta pasa a pagada. El destino se copia al
  crear y no sigue cambios posteriores de `BuyerSnapshot`.
- Estados: pending, preparing, dispatched, delivery_check, delivered, issue,
  returned, cancelled y closed. La transición repetida no crea evento ni
  notificación. Un pedido impago no despacha.
- `ShipmentEvent`, `DeliveryConfirmation` y `FollowUpSchedule` quedan listos
  para T3.2–T3.6. Admin de envíos es solo lectura.

Validación ejecutada:

- 5 pruebas de dominio de despacho aprobadas, más la suite de ventas existente.

### T3.2 — Operación y tracking manual

- GraphQL seller: `shippingDashboard`, `shipments`, `shipment`,
  `shipmentTimeline`, `updateShipment` y `markShipmentDispatched`. Las mutations
  llevan clave de idempotencia. El listado y el dashboard aíslan por
  Tienda e inventario.
- Transportista y tracking se editan solo en `pending` o `preparing`. El primer
  guardado pasa a preparación. Despachar desde pendiente prepara y despacha en
  el mismo comando. Después de `dispatched` el tracking queda de solo lectura.
- La línea de tiempo conserva actor, fecha y `isPublic` para distinguir notas
  internas. Tenda no consulta al transportista: copiar el código es local y la
  URL externa se abre con advertencia.
- Web reemplaza el placeholder de Despachos por listado, filtros y detalle.
  Mobile usa tarjetas verticales y el mismo contrato.

Validación ejecutada:

- Backend: 9 pruebas de despacho aprobadas (dominio + operación GraphQL).
- Web Vitest: 3 pruebas de despachos aprobadas (listado, copia, URL externa y
  edición bloqueada).
- Mobile Jest: 3 pruebas de despachos aprobadas (tarjetas, advertencia externa y
  detalle sin edición tras despacho).

### T3.3 — Etiqueta interna genérica

- `LabelDocument` persiste un PDF A4 generado con ReportLab en el almacén
  privado (mismo ciclo que exportes). El propósito de media es `shipping_label`.
- Mutation seller `generateShipmentLabel` con clave de idempotencia. No genera
  si el pedido está impago o faltan destinatario/dirección/ciudad en despacho.
  El PDF muestra «Etiqueta interna Tenda» y no usa plantilla ni logo de
  transportista. El enlace firmado dura 300 s; el documento caduca a las 24 h.
- Web: preview en modal y descarga firmada desde el detalle. Mobile abre el
  PDF con la misma advertencia de documento interno.

Validación ejecutada:

- Backend: 12 pruebas de despacho aprobadas (dominio, operación GraphQL y
  etiquetas: PDF, expiración, impago, datos incompletos, aislamiento tenant).
- Web Vitest: 4 pruebas de despachos (incluye preview de etiqueta interna).
- Mobile Jest: 4 pruebas de despachos (incluye advertencia de etiqueta interna).

### T3.4 — Seguimiento y confirmación pública

- Token opaco con TTL de 90 días. `GET /s/{token}` entrega HTML mínimo
  `noindex`. GraphQL `publicShipment` muestra vendedor, resumen, tracking y
  timeline solo con eventos públicos; los estados técnicos se mapean a
  Preparando, Despachado, Recibido y Hay una consulta.
- `POST /api/v1/public/shipments/{token}/confirm` es idempotente. «Sí, lo
  recibí» pasa el envío a `delivered`. «No, necesito ayuda» no marca
  incidencia: guarda la confirmación y deriva a `/s/:token/consulta` (ticket
  en T3.5). Rate limit y Turnstile cubren la acción crítica.
- Tras `delivered`, `activeFulfilment` deja de contar esa venta y la línea
  desaparece del desglose de operaciones activas. El historial de
  `productOrders` no se oculta.
- Web: `/s/:token`, `/s/:token/confirmar` (resumen antes del Sí) y stub de
  consulta. El vendedor copia el enlace público desde el detalle. Mobile
  comparte el mismo enlace.

Validación ejecutada:

- Backend: 19 pruebas de despacho aprobadas (incluye HTML público, GraphQL
  tenant-safe, confirmación idempotente, needs_help sin issue, token
  expirado, rate limit y baja de operaciones activas).
- Web Vitest: 7 pruebas de despachos/público (incluye copia del enlace y
  confirmación con resumen previo).
- Mobile Jest: 4 pruebas de despachos (incluye compartir enlace público).

Próximo paquete habilitado: T3.5, tickets y consultas del envío.

### T3.5 — Tickets y conversación

- `Ticket` y `TicketMessage` viven en la app `shipping`. Un envío reutiliza el
  ticket abierto (`open`, `awaiting_seller`, `awaiting_buyer`) hasta resolverlo.
  Los mensajes son append-only. Resolver no cierra ni autocierra.
- GraphQL: `ticket`, `openPublicTicket`, `sendTicketMessage` y `resolveTicket`.
  El comprador solo entra con el token público y Turnstile. «No, necesito ayuda»
  crea o reutiliza el ticket y no marca incidencia.
- El correo de outbox (`shipping.ticket_notification`) lleva número de consulta,
  envío y venta, más un enlace cifrado. No copia el cuerpo ni el contacto.
- Web pública: `/s/:token/consulta` con categoría, mensaje y contacto
  prellenado. Web seller: `/app/despachos/:id/tickets/:ticketId`. Mobile abre
  el hilo en `despachos/ticket/[ticketId]` para no romper la ruta del detalle.

Validación ejecutada:

- Backend: 25 pruebas de despacho aprobadas (incluye reutilización del ticket,
  aislamiento por token, `awaiting_*`, resolución sin cierre, email sin PII,
  needs_help sin issue y rate limit de la consulta pública).
- Web Vitest: 9 pruebas de despachos/público (incluye formulario de consulta y
  respuesta del vendedor).
- Mobile Jest: 5 pruebas de despachos (incluye hilo y envío de respuesta).

Decisiones/deuda:

- Node local sigue en 20.19.2; codegen se ejecutó con el binario del paquete.
- Las cadencias, el autocierre y `ReturnCase` quedan en T3.6.

Próximo paquete habilitado: T3.6, cadencias de seguimiento y cierre de consulta.

### T3.6 — Cadencias, incidencias y devoluciones

- Seeds globales: `shipping.delivery_check_hours` (72), `shipping.awaiting_reminder_hours`
  (48), `shipping.autoclose_days` (7) y `sales.proof_review_hours` (24). Un cambio de
  parámetro solo afecta agendas nuevas; `due_at` vive en PostgreSQL.
- Al despachar se programa el chequeo de entrega. El worker
  `process_due_follow_ups` (beat 60 s) pasa `dispatched` → `delivery_check`.
- Un ticket en `awaiting_buyer` agenda el recordatorio. Tras enviarlo se agenda el
  autocierre. El autocierre no ocurre sin ese escalamiento previo; resolver no cierra.
- `rescheduleFollowUp` exige motivo y deja auditoría `shipping.follow_up_rescheduled`.
- `ReturnCase` registra pérdida, rechazo, devolución u otro resultado y no mueve
  stock. `confirmReturnToStock` crea la entrada compensatoria con
  `reference_type=shipping.return_case`.
- Web y mobile muestran vencimiento, origen del parámetro, reprogramación y el
  panel de incidencia/devolución.

Validación ejecutada:

- Backend: 32 pruebas de despacho aprobadas (incluye agenda en PostgreSQL, parámetro
  que no mueve `due_at` viejo, reminder/autocierre, reprogramación auditada,
  ReturnCase sin reposición y confirmación de stock).
- Web Vitest: 6 pruebas de despachos seller (incluye vencimiento, cadencia y
  registro de incidencia).
- Mobile Jest: 5 pruebas de despachos (incluye vencimiento en la tarjeta).

Decisiones/deuda:

- Node local sigue en 20.19.2; codegen se ejecutó con el binario del paquete.
- El hardening E2E, axe y go-live se cerraron en T3.7. T4 no se implementa.

### T3.7 — Hardening, accesibilidad y go-live

- Playwright en `e2e/web` cubre el journey
  login → inventario → venta → pago con comprobante → balance → despacho →
  recepción. TST-DSP-02: la confirmación pública repetida muestra el estado
  actual. Un segundo caso abre consulta con «No, necesito ayuda» y no marca
  incidencia.
- axe-core (WCAG 2.2 AA, impactos critical/serious) corre sobre landing, login,
  inventario y Más. El botón «Agregar con asistente» permanece disabled.
- Maestro smoke en `frontend/mobile/.maestro/smoke.yaml` (login, tabs, anuncio
  del agente). No corre en CI: requiere emulador o dispositivo.
- `prepare_e2e_journey` crea el owner verificado `e2e.owner@tenda.test` y
  borra `AuthRateLimitBucket` para que corridas locales repetidas no bloqueen
  el login.
- CI añade el job `e2e` (Chromium, Postgres 17, Redis 7).
- Documentación de cierre del MVP: `docs/architecture.md` (carpetas y
  despliegue), `docs/go-live.md` (matriz y bloqueos humanos),
  `docs/accessibility.md` (axe + checklist manual).

Validación ejecutada:

- Backend: incluye `test_e2e_prepare` (comando idempotente; limpia rate limits).
- Web Vitest: el detalle de despacho expone «Abrir seguimiento público».
- Playwright y axe: 3/3 en Chromium local (axe WCAG, journey de recepción
  TST-DSP-02, «No, necesito ayuda» abre consulta sin marcar incidencia).
  CI: job `e2e` / `pnpm test:e2e`.

Decisiones/deuda:

- Node local sigue en 20.19.2.
- Restore real, Kuma, dominios, R2, Brevo, Mercado Pago Chile, cadencias y
  retención de Producción bloquean el go-live. No se convierte en código T4.
- `AGENT_FEATURE_STATUS=coming_soon`; no hay app, cola ni worker de agente.

Próximo paquete habilitado: ninguno de producto. El MVP de Etapas 0–3 está
cerrado en código. T4 permanece fuera de alcance.

### T3.8 — Despachos simplificados a «registrar y notificar»

El flujo de T3.1–T3.6 (máquina de 9 estados, línea de tiempo, seguimiento
público, tickets, cadencias y devoluciones) se retiró. Lo que sigue vigente:

- `Shipment` nace al pagar la venta y solo tiene tres estados: `pending`,
  `dispatched` y `delivered`. Conserva el snapshot de destino y la etiqueta
  interna PDF (`LabelDocument`, `generateShipmentLabel`, «Ver etiqueta»).
- Una sola mutation idempotente, `registerShipmentDispatch(shipmentId, input,
  idempotencyKey)`. Con modalidad `shipping` exige transportista (tracking y
  URL opcionales) y deja el envío en `dispatched`; con `pickup` o
  `coordinated` no pide transportista y lo deja en `delivered`. Un envío ya
  registrado responde `SHIPMENT_ALREADY_REGISTERED`; un pedido impago,
  `ORDER_NOT_PAID`.
- Al registrar se encola `shipping.shipment_notification` con plantilla
  `shipment.dispatched` («Tu pedido va en camino»: transportista, tracking,
  botón «Seguir envío», destino, nota, detalle e importe) o
  `shipment.delivered` («Tu pedido fue entregado»). Si el comprador no dejó
  correo, no se envía nada y la UI lo advierte antes de confirmar.
- Se eliminaron `ShipmentEvent`, `DeliveryConfirmation`, `FollowUpSchedule`,
  `Ticket`, `TicketMessage`, `ReturnCase`, el token público, las rutas `/s/*`
  y `/api/v1/public/shipments/*`, la tarea `process_due_follow_ups`, los
  parámetros `shipping.*` y los rate limits públicos de envío. Migraciones
  `shipping.0007` (colapsa estados y borra tablas) y `configuration.0006`.
- `inventory.activeFulfilment` considera liquidado un envío en `dispatched`
  o `delivered`.
- Web: listado con tarjetas Pendientes/Despachados/Entregados, filtros por
  estado y modalidad, columna «Transportista / Tracking»; detalle con tarjeta
  «Destino» y formulario «Registrar despacho» / «Registrar entrega» con
  modal de confirmación que anuncia el correo. Después del registro la
  tarjeta queda de solo lectura. Mobile replica el flujo con `Sheet`.
- E2E: el journey termina en el registro del despacho y verifica la fila
  «Chilexpress · CX-E2E-01» en el listado.

Validación ejecutada:

- Backend: 147 pruebas aprobadas (incluye 9 de dominio de despacho, 4 de
  operación GraphQL, 4 de etiqueta y 2 de render de correo); ruff y mypy sin
  hallazgos nuevos en `shipping`, `notifications`, `inventory` y `sales`;
  `makemigrations --check` limpio.
- `@tenda/api-client`: schema exportado, codegen y build.
- Web Vitest: 75 pruebas aprobadas (5 de despachos).
- Mobile Jest: 48 pruebas aprobadas (6 de despachos).

Decisiones/deuda:

- La reposición de stock por devolución dejó de existir como flujo; si se
  necesita, se resuelve con un ajuste manual de inventario.
- Los envíos históricos en `preparing` quedaron en `pending`; los que estaban
  en `delivery_check`, `issue`, `returned` o `cancelled` pasaron a
  `dispatched`; `closed` pasó a `delivered`.
