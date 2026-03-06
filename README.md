# my-lumea-assets-app (Web + Wrangler)

Aplicacion web para alta de productos con imagen:
- Frontend React + Vite (acceso por LAN)
- Backend Cloudflare Worker (API REST)
- D1 por binding `DB`
- R2 por binding `ASSETS_BUCKET`

## Configuracion de Wrangler

El archivo [wrangler.jsonc](./wrangler.jsonc) ya incluye:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "lumea-db",
    "database_id": "30792dc6-1df8-4dab-ae0a-7f97914e48c2"
  }
],
"r2_buckets": [
  {
    "binding": "ASSETS_BUCKET",
    "bucket_name": "lumea-assets"
  }
]
```

## Requisitos

1. Node.js 20+
2. Wrangler autenticado:

```bash
npx wrangler login
```

## Instalacion

```bash
npm install
```

## Desarrollo local por LAN

Este comando levanta:
- Worker API en `0.0.0.0:8787` (modo remoto para usar D1/R2 reales)
- Frontend en `0.0.0.0:5173`

```bash
npm run dev
```

Desde otro dispositivo en tu red local abre:

```text
http://<IP_DE_TU_PC>:5173
```

Nota de red en Windows:
- Usa la IP de tu adaptador con gateway de tu router (ejemplo en este equipo: `192.168.100.4`), no la IP host-only como `192.168.56.1`.
- Si no entra desde el telefono, abre puertos en PowerShell ejecutado como Administrador:

```powershell
netsh advfirewall firewall add rule name="Lumea Vite 5173" dir=in action=allow protocol=TCP localport=5173 profile=private
netsh advfirewall firewall add rule name="Lumea Worker 8787" dir=in action=allow protocol=TCP localport=8787 profile=private
```

## Endpoints del Worker

- `GET /api/health`
- `GET /api/products`
- `GET /api/products?type=ring`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/orders` (listado + filtros + paginacion)
- `GET /api/orders/:id` (detalle completo)
- `PATCH /api/orders/:id` (edicion operativa con Bearer token)
- `GET /api/product-types`
- `GET /api/product-types/:id`
- `POST /api/product-types`
- `PATCH /api/product-types/:id`
- `DELETE /api/product-types/:id`
- `POST /api/upload` (multipart con campo `file`)
- `GET /api/assets/:key`

Para mutaciones de pedidos (`PATCH /api/orders/:id`) configura:

- `ADMIN_API_TOKEN` como secreto del Worker:
```bash
npx wrangler secret put ADMIN_API_TOKEN
```
- En local crea `.dev.vars` con:
```bash
ADMIN_API_TOKEN=tu_token
```
- Header: `Authorization: Bearer <ADMIN_API_TOKEN>`.

## Build y deploy

```bash
npm run build
npm run deploy
```
