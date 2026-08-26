# Go-live del MVP (Etapas 0–3)

El código de las Etapas 0–3 está cerrado. T3.7 deja artefactos de E2E, axe,
runbooks y esta matriz. **No autoriza a publicar Producción** hasta que los
asuntos humanos de la tabla estén en verde o bloqueados por escrito.

La Etapa 4 no se despliega. `AGENT_FEATURE_STATUS` permanece en `coming_soon`.

## Gate de salida (Documento 03 §9.1)

| Criterio                                                           | Estado en código     | Pendiente humano     |
| ------------------------------------------------------------------ | -------------------- | -------------------- |
| Pedido impago no despacha                                          | Cubierto (T3.1)      | —                    |
| Etiqueta interna y tracking coherentes con la vista pública        | Cubierto (T3.3–T3.4) | Impresión física     |
| Confirmación pública repetida idempotente                          | API + E2E TST-DSP-02 | —                    |
| «No» crea/reutiliza ticket sin marcar incidencia                   | Cubierto + E2E       | —                    |
| ReturnCase no repone stock hasta `confirmReturnToStock`            | Cubierto (T3.6)      | —                    |
| Producto recibido sale de operaciones activas y conserva historial | Cubierto             | —                    |
| Playwright journey + axe                                           | `pnpm test:e2e`      | Revisión manual WCAG |
| Backup/restore, rollback, Kuma                                     | Scripts + runbook    | Ensayo real en VPS   |
| Agente solo «Próximamente»                                         | Tests + E2E          | —                    |

## Matriz de configuración de Producción

Los valores de desarrollo (Turnstile fake, R2 fake, Brevo fake, Mercado Pago
fake, cadencias seed) **no** son una aprobación de Producción.

| Dependencia          | Sin credencial (Dev/E2E)            | Requerido para Producción                        | Go-live   |
| -------------------- | ----------------------------------- | ------------------------------------------------ | --------- |
| Dominios / TLS       | `localhost`                         | Dominio, certificados, `WEB_ORIGIN` HTTPS        | Bloqueado |
| Cloudflare R2        | `OBJECT_STORAGE_PROVIDER=fake`      | Bucket/prefijo, CORS, lifecycle, claves mínimas  | Bloqueado |
| Backup R2 + age      | No corre off-site                   | Recipient, bucket privado, retención aprobada    | Bloqueado |
| Brevo                | Outbox fake                         | Dominio autenticado, templates, webhook bounce   | Bloqueado |
| Google OIDC          | Adapter fake                        | Client ID/secret y callback Prod                 | Opcional  |
| LinkedIn OIDC        | Flag off                            | Solo si producto OIDC está habilitado            | Fuera     |
| Mercado Pago Chile   | Fake; transferencia/efectivo operan | OAuth, pago, refund, webhook, fee, desconexión   | Bloqueado |
| Cadencias            | Seeds 72 h / 48 h / 7 d / 24 h      | Valores de Producción firmados                   | Bloqueado |
| Retención/privacidad | Sin jobs de borrado                 | Política de comprador, tickets, fotos, analítica | Bloqueado |
| Analítica            | No hay tracker                      | Consentimiento si se incorpora                   | Bloqueado |
| App stores           | Build local / EAS interno + Maestro | Cuentas, privacy disclosures, deep links         | Bloqueado |
| VPS App/Ops          | Un solo host alcanza para Dev       | WireGuard, Kuma, Netdata/Portainer restringidos  | Bloqueado |
| Django Admin         | `/admin` local                      | `control-*`, red WireGuard, MFA de acceso        | Bloqueado |
| Sentry               | DSN vacío                           | DSN Prod y scrub de PII ya implementado          | Opcional  |

Hasta que un ítem «Bloqueado» se apruebe, el go-live permanece detenido. No
convierte esos huecos en código de Etapa 4 ni en integraciones reales desde
este repositorio.

## Seguridad ya implementada (no rehacer)

- Tokens públicos opacos y con TTL (pedido y envío).
- Rate limit durable en PostgreSQL para auth, Admin, confirmación y consulta.
- CSRF cookie + header en web; mobile bearer sin cookie de sesión.
- CORS acotado a `WEB_ORIGIN`; CSP en Django y Nginx.
- Uploads con propósito, tipo, tamaño y aislamiento tenant.
- Postgres/Redis sin puertos públicos en Compose Dev/Prod.
- Trivy, `pnpm audit` y `pip-audit` en CI; `manage.py check --deploy` en Prod.

## Restore, rollback y observabilidad

El procedimiento está en `docs/runbooks/operations.md`. T3.7 no ejecuta el
ensayo contra un VPS real. TST-OPS-01 queda **pendiente de evidencia**:

1. Backup cifrado a R2 de un ambiente descartable.
2. Restore a `tenda_restore_drill`.
3. Migraciones + smoke E2E (login y un pedido/envío) contra esa base.
4. Registrar object key, SHA-256, duración y resultado.
5. Detener Nginx de forma controlada y comprobar alerta de Kuma desde VPS Ops.

Sin ese registro, el go-live sigue bloqueado aunque CI esté verde.

## Cómo desplegar cuando la matriz esté en verde

```bash
# 1. CI en main/master en verde (jobs quality + e2e)
# 2. Publish images (SHA de 40 caracteres)
# 3. Deploy manual al ambiente protegido:
#    image_sha = <git sha>
#    environment = production
#    skip_predeploy_backup = false
```

En el host, `infra/scripts/deploy.sh` es la única vía. No usar `latest` ni
`compose up` improvisado sobre Producción.

## Mobile

El smoke Maestro (`frontend/mobile/.maestro/smoke.yaml`) se corre en un
emulador o dispositivo con el owner de `prepare_e2e_journey`. No publica la
app. La prioridad Android/iOS, cuentas de store y deep links siguen en la
matriz.
