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
  - incluye estado `schema.products_enriched`, `schema.product_variants`, `schema.product_reviews`
- `GET /api/products`
- `GET /api/products?type=ring`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/products/:id/variants`
- `POST /api/products/:id/variants`
- `PATCH /api/products/:id/variants/:variantId`
- `DELETE /api/products/:id/variants/:variantId`
- `GET /api/products/:id/reviews`
- `POST /api/products/:id/reviews`
- `PATCH /api/products/:id/reviews/:reviewId`
- `DELETE /api/products/:id/reviews/:reviewId`
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

## Contrato de producto enriquecido (SEO v2)

`POST /api/products` y `PATCH /api/products/:id` aceptan el contrato legacy y tambien campos SEO/comerciales:

```json
{
  "title": "Collar Aura",
  "slug": "collar-aura",
  "seo_slug": "collar-aura-chapado-en-oro",
  "type": "necklace",
  "short_desc": "Diseno minimalista chapado en oro.",
  "description": "Descripcion larga",
  "price_cents": 89900,
  "stock": 12,
  "image_key": "products/....webp",
  "sku": "LUM-NEC-001",
  "brand": "Lumea Imperium",
  "material": "laton",
  "base_metal": "laton",
  "finish_text": "chapado en oro 18k",
  "main_color": "dorado",
  "hypoallergenic": 1,
  "care_instructions": "Evitar agua y perfume.",
  "gift_ready": 1,
  "package_includes": "Caja premium + tarjeta",
  "shipping_time_min_days": 2,
  "shipping_time_max_days": 5,
  "return_window_days": 30,
  "is_bestseller": 1,
  "is_new_arrival": 0,
  "is_active": 1,
  "is_featured": 1,
  "currency": "MXN",
  "sort": 10
}
```

Respuesta de listado/detalle incluye `canonical_path` calculado:

- `canonical_path = "/producto/" + (seo_slug || slug)`

## Contrato de variantes

`/api/products/:id/variants`:

```json
{
  "sku": "LUM-NEC-001-S",
  "option_name": "talla",
  "option_value": "S",
  "price_cents": null,
  "stock": 5,
  "is_active": 1
}
```

- `price_cents` puede ser `null` (override opcional).
- `stock` debe ser entero >= 0.

## Contrato de reseñas

`/api/products/:id/reviews`:

```json
{
  "author_name": "Ana",
  "rating": 5,
  "title": "Excelente regalo",
  "body": "Buena presentacion y acabado.",
  "verified_purchase": 1,
  "is_published": 0
}
```

- Si no envias `is_published`, queda en borrador (`0`).
- `rating` valido entre `1` y `5`.

## Compatibilidad gradual de esquema

- Si faltan migraciones `0005/0006`, los endpoints de variantes/reseñas responden:
  - HTTP `409`
  - `code: "schema_not_ready"`
- Los endpoints legacy de productos siguen operando.

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
