# Accesibilidad (WCAG 2.2 AA)

Objetivo del Documento 02 §12: WCAG 2.2 AA, teclado, foco, labels, resumen de
errores, status messages y tamaño de objetivo. axe no reemplaza la revisión
manual.

## Automatizado

Playwright corre axe-core sobre landing, login, inventario autenticado y Más
(anuncio del agente). Fallan impactos `critical` y `serious` con tags
`wcag2a`, `wcag2aa`, `wcag21aa` y `wcag22aa`.

```bash
pnpm test:e2e
```

El journey E2E también ejercita labels de formularios públicos y seller
(checkout, comprobante, confirmación, consulta, tracking).

## Checklist manual (antes de go-live)

Recorrer con teclado, lector de pantalla (NVDA o VoiceOver) y viewport 360 px
y 1280 px:

- [ ] Orden de foco visible en login, alta de producto, wizard de venta y checkout público.
- [ ] Cada control tiene nombre accesible; los errores se anuncian (`role="alert"` o `aria-invalid`).
- [ ] Resumen de errores del producto y del checkout enlaza al campo.
- [ ] Status messages (comprobante enviado, copiado, servicio no disponible) se anuncian.
- [ ] Objetivos táctiles próximos a 44×44 px en mobile y en la barra inferior.
- [ ] Autenticación accesible: no se pide copiar un código de un solo uso en un campo de login.
- [ ] Modales (aprobar comprobante, despachar, URL externa) cierran con Escape y devuelven el foco.
- [ ] El asistente con foto permanece deshabilitado y se anuncia «Próximamente».
- [ ] Contraste de texto y chips de estado sobre el fondo `#f7f5ef`.
      T3.7 oscureció `--clay-strong` y `--ink-muted` para 4.5:1; axe lo cubre.

La impresión de etiqueta y el tamaño térmico no forman parte de esta revisión.

## Convenciones en código

- `lang="es"` en `frontend/web/index.html`.
- Formularios con `<label htmlFor>` o label envolvente.
- `FormErrorSummary` y `role="alert"` en fallos de API.
- `aria-live` en health, búsquedas y cargas públicas.
- Botones de icono con `aria-label` (navegación colapsada, cerrar modal, notificaciones).
- Mobile: `accessibilityLabel` en campos y `accessibilityRole="button"` en primarios.
