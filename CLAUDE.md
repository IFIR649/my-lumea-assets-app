# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Resumen rapido

Panel interno de Lumea Imperium para administrar productos, galeria de assets en R2, variantes, resenas, pedidos, y envios con Envia. El flujo principal es **React/Vite + Cloudflare Worker**, con una capa **Electron** activa para tareas locales (descarga/impresion de PDFs, manejo de archivos).

## Stack

- Frontend: React 19 + Vite + TypeScript + Tailwind (`src/renderer`)
- API: Cloudflare Worker en TypeScript (`worker/`)
- Datos: Cloudflare D1 (binding `DB`)
- Assets: Cloudflare R2 (binding `ASSETS_BUCKET`)
- Desktop: Electron + preload IPC (`src/main/`, `src/preload/`)
- Envios: Envia API (`worker/envia.ts`)

## Comandos

```bash
npm install

# Desarrollo local (Worker en :8787 remoto + frontend en :5173)
npm run dev

# Solo frontend (contra Worker publico en workers.dev)
npm run dev:workers        # alias de dev:web:workers

# Por separado
npm run dev:web            # solo Vite
npm run dev:worker         # solo Wrangler (--remote, usa D1/R2 reales)

# Validacion
npm run typecheck          # corre typecheck:web (tsconfig.web.json) + typecheck:worker (tsconfig.worker.json)
npm run lint

# Build y deploy
npm run build              # typecheck + vite build
npm run deploy             # build + wrangler deploy
```

Vite hace proxy de `/api` a `VITE_API_PROXY_TARGET` o `http://127.0.0.1:8787`.

### Secretos locales

Crea `.dev.vars` en la raiz para Wrangler local:

```
ADMIN_API_TOKEN=tu_token
ENVIA_API_KEY=...
ENVIA_MODE=test|live
```

Para produccion: `npx wrangler secret put NOMBRE_VAR`.

## Arquitectura y flujo

### Frontend → Worker

El frontend siempre pega a rutas relativas `/api/...`. En desarrollo, Vite hace proxy al Worker local. La UI esta en espanol; conservar ese tono al agregar texto visible.

### Worker (`worker/index.ts`)

Concentra toda la logica de negocio: health checks de D1/R2/Envia/esquema, CRUD de productos/variantes/resenas, uploads de assets, listado/detalle de pedidos, administracion de envios y cajas, webhook y sincronizacion con Envia. Tiene `scheduled()` para sync periodico (cron `*/15 * * * *`).

### Envia (`worker/envia.ts`)

Adaptador a la API de Envia. Normaliza carriers, servicios, cotizaciones, tracking y errores. Si editas el flujo de envios, revisar tambien `worker/index.ts` y `ShipmentsManager.tsx`.

### Electron (`src/main/index.ts`, `src/preload/index.ts`)

Carga `.env` para datos de R2 (`CF_R2_*`). Expone `window.api` via preload para: seleccion de carpetas, descarga/apertura/impresion de PDFs, subida directa a R2. Si modificas cualquiera de estos tres archivos, mantener alineado el contrato de `window.api` en `src/preload/index.d.ts`.

## Compatibilidad de esquema

Si faltan migraciones `0005/0006`, los endpoints de variantes/resenas responden HTTP 409 con `code: "schema_not_ready"`. Los endpoints de productos siguen operando. Mantener compatibilidad hacia atras en el Worker cuando ya exista codigo defensivo para columnas/tablas opcionales.

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `worker/index.ts` | Router principal del Worker, toda la logica de negocio |
| `worker/envia.ts` | Adaptador Envia (cotizaciones, guias, tracking) |
| `src/renderer/src/App.tsx` | Shell principal del admin (vistas: create, assets, products, variants, reviews, orders, shipments, connections) |
| `src/renderer/src/components/ShipmentsManager.tsx` | Flujo de envios: cotizacion, aprobacion, cancelacion, PDFs |
| `src/renderer/src/components/AssetsManager.tsx` | Cola local, optimizacion WebP, upload a `/api/upload`, exploracion R2 |
| `src/main/index.ts` | Proceso principal Electron |
| `src/preload/index.ts` + `index.d.ts` | Contrato tipado de `window.api` |

## Validacion recomendada despues de cambios

Minimo: `npm run typecheck && npm run lint`.

Si cambiaste integraciones o flujos completos, validar manualmente:

- `/api/health` (muestra estado D1/R2/Envia/esquema)
- Carga de productos, upload/listado de assets
- Pedidos y shipments segun el caso

## Configuracion y secretos

### Worker / Wrangler (vars y bindings en `wrangler.jsonc`)

- Bindings: `DB` (D1), `ASSETS_BUCKET` (R2)
- Vars: `R2_PUBLIC_BASE_URL`, `CORS_ORIGIN`, `ENVIA_TIMEOUT_MS`
- Secretos: `ADMIN_API_TOKEN`, `ENVIA_API_KEY`, `ENVIA_MODE`, `ENVIA_SHIPPING_BASE_URL`, `ENVIA_QUERIES_BASE_URL`, `ENVIA_GEOCODES_BASE_URL`, `ENVIA_WEBHOOK_TOKEN`, `ENVIA_FROM_*`, `ENVIA_DEFAULT_*`, `ENVIA_ALLOWED_CARRIERS`

### Electron local (`.env`)

`CF_R2_ENDPOINT`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`, `CF_R2_BUCKET_NAME`, `CF_R2_PUBLIC_BASE_URL`

## Caveats

- El arbol puede tener cambios locales no relacionados; revisar `git status` antes de ediciones grandes.
- `conexion-lan-main/` es un subproyecto separado; no mezclar con el flujo principal salvo que la tarea lo pida.
- Electron no esta expuesto en scripts principales de `package.json` pero no es codigo muerto.
