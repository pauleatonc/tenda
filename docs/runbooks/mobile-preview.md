# Mobile preview APK (EAS)

Build interno instalable contra producción (`https://tenda-app.com`), sin pasar
por Play Store. Package: `cl.tenda.app`.

## Requisitos

1. Cuenta [Expo](https://expo.dev)
2. Node 20+ y pnpm (monorepo)
3. Una sola vez, desde `frontend/mobile`:

```bash
cd frontend/mobile
npx eas-cli login
npx eas-cli init
# Con app.config.js dinámico, init no puede escribir solo: el projectId
# ya está en app.config.js (extra.eas.projectId).
```

Opcional (analytics nativo):

- `google-services.json` en `frontend/mobile/` (gitignored), o secreto EAS file
- Sin ese archivo el APK igual se genera; Firebase Analytics queda no-op

Opcional (Turnstile en login/registro):

```bash
cd frontend/mobile
npx eas-cli env:create --name EXPO_PUBLIC_TURNSTILE_SITE_KEY --value '<site-key>' --environment preview --visibility plaintext
```

## Build preview (APK)

```bash
cd frontend/mobile
pnpm eas:preview:android
# equivalente:
# npx eas-cli build -p android --profile preview
```

El monorepo ignora `dist/` en git. Metro resuelve `@tenda/api-client` /
`@tenda/analytics` desde `src/` (con rewrite `.js`→`.ts` en
`metro.config.js`). `eas-build-post-install` sigue compilando `dist/` por si
hace falta en otros consumers.

El profile `preview` en `eas.json` fija:

- `EXPO_PUBLIC_API_URL=https://tenda-app.com`
- `EXPO_PUBLIC_WEB_ORIGIN=https://tenda-app.com`
- `android.buildType=apk`, `distribution=internal`

Al terminar, EAS muestra un link de descarga. Instalá el APK en el celular
(USB / enlace; puede hacer falta «orígenes desconocidos»).

## Verificar

1. Abrir la app → login con una cuenta real de prod (o la de prueba).
2. Confirmar que API responde (dashboard / inventario).
3. Smoke Maestro (opcional) con el APK instalado y `prepare_e2e_journey`.

## Production AAB (más adelante)

```bash
cd frontend/mobile
pnpm eas:production:android
```

Eso genera un **AAB** para Play Console (`eas submit` o subida manual). No es
necesario para la opción B.
