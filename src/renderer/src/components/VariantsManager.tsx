import { useEffect, useMemo, useState } from 'react'
import { Pencil, RefreshCw, Save, Trash2, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type ProductLite = {
  id: number
  title: string
  slug: string
}

type Variant = {
  id: number
  product_id: number
  sku: string
  option_name: string
  option_value: string
  price_cents: number | null
  stock: number
  is_active: number
  created_at: string
}

type VariantForm = {
  sku: string
  option_name: string
  option_value: string
  price_cents: string
  stock: string
  is_active: boolean
}

type VariantsManagerProps = {
  products: ProductLite[]
}

const EMPTY_FORM: VariantForm = {
  sku: '',
  option_name: '',
  option_value: '',
  price_cents: '',
  stock: '0',
  is_active: true
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

function parsePriceOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN
}

export default function VariantsManager({ products }: VariantsManagerProps): React.JSX.Element {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(products[0]?.id ?? null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [schemaBlocked, setSchemaBlocked] = useState(false)
  const [form, setForm] = useState<VariantForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [edit, setEdit] = useState<VariantForm>(EMPTY_FORM)

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  )

  useEffect(() => {
    if (!products.length) {
      setSelectedProductId(null)
      setVariants([])
      return
    }
    if (
      selectedProductId === null ||
      !products.some((product) => product.id === selectedProductId)
    ) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  const loadVariants = async (): Promise<void> => {
    if (!selectedProductId) return
    setLoading(true)
    try {
      const payload = await requestJson<{
        success: boolean
        variants?: Variant[]
        code?: string
        error?: string
      }>(`/api/products/${selectedProductId}/variants`)
      if (!payload.success) {
        throw new Error(payload.error || 'No se pudieron cargar variantes.')
      }
      setVariants(payload.variants || [])
      setSchemaBlocked(false)
      setMsg(null)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Error desconocido'
      if (text.includes('schema_not_ready') || text.includes('Faltan migraciones 0005/0006')) {
        setSchemaBlocked(true)
        setVariants([])
        setMsg({
          type: 'error',
          text: 'Faltan migraciones 0005/0006 en D1 para gestionar variantes.'
        })
      } else {
        setMsg({ type: 'error', text })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVariants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId])

  const createVariant = async (): Promise<void> => {
    if (!selectedProductId || schemaBlocked) return
    const price = parsePriceOrNull(form.price_cents)
    const stock = Number.parseInt(form.stock, 10)
    if (Number.isNaN(price))
      return setMsg({ type: 'error', text: 'price_cents invalido (entero >= 0 o vacio).' })
    if (!Number.isInteger(stock) || stock < 0)
      return setMsg({ type: 'error', text: 'stock invalido.' })
    if (!form.sku.trim() || !form.option_name.trim() || !form.option_value.trim()) {
      return setMsg({ type: 'error', text: 'sku, option_name y option_value son obligatorios.' })
    }

    setSaving(true)
    setMsg({ type: 'info', text: 'Creando variante...' })
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/variants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: form.sku.trim(),
            option_name: form.option_name.trim(),
            option_value: form.option_value.trim(),
            price_cents: price,
            stock,
            is_active: form.is_active ? 1 : 0
          })
        }
      )
      if (!payload.success) throw new Error(payload.error || 'No se pudo crear variante.')
      setForm(EMPTY_FORM)
      await loadVariants()
      setMsg({ type: 'success', text: 'Variante creada.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error creando variante.'
      })
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (variant: Variant): void => {
    setEditingId(variant.id)
    setEdit({
      sku: variant.sku,
      option_name: variant.option_name,
      option_value: variant.option_value,
      price_cents: variant.price_cents == null ? '' : String(variant.price_cents),
      stock: String(variant.stock),
      is_active: variant.is_active === 1
    })
  }

  const saveEdit = async (): Promise<void> => {
    if (!selectedProductId || !editingId || schemaBlocked) return
    const price = parsePriceOrNull(edit.price_cents)
    const stock = Number.parseInt(edit.stock, 10)
    if (Number.isNaN(price))
      return setMsg({ type: 'error', text: 'price_cents invalido (entero >= 0 o vacio).' })
    if (!Number.isInteger(stock) || stock < 0)
      return setMsg({ type: 'error', text: 'stock invalido.' })
    if (!edit.sku.trim() || !edit.option_name.trim() || !edit.option_value.trim()) {
      return setMsg({ type: 'error', text: 'sku, option_name y option_value son obligatorios.' })
    }

    setSaving(true)
    setMsg({ type: 'info', text: 'Actualizando variante...' })
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/variants/${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: edit.sku.trim(),
            option_name: edit.option_name.trim(),
            option_value: edit.option_value.trim(),
            price_cents: price,
            stock,
            is_active: edit.is_active ? 1 : 0
          })
        }
      )
      if (!payload.success) throw new Error(payload.error || 'No se pudo actualizar variante.')
      setEditingId(null)
      setEdit(EMPTY_FORM)
      await loadVariants()
      setMsg({ type: 'success', text: 'Variante actualizada.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error actualizando variante.'
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteVariant = async (variant: Variant): Promise<void> => {
    if (!selectedProductId || schemaBlocked) return
    if (!window.confirm(`Eliminar variante ${variant.sku}?`)) return
    setSaving(true)
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/variants/${variant.id}`,
        { method: 'DELETE' }
      )
      if (!payload.success) throw new Error(payload.error || 'No se pudo eliminar variante.')
      if (editingId === variant.id) {
        setEditingId(null)
        setEdit(EMPTY_FORM)
      }
      await loadVariants()
      setMsg({ type: 'success', text: 'Variante eliminada.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error eliminando variante.'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Variantes por producto</h2>
          <button
            type="button"
            onClick={() => void loadVariants()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold"
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Recargar
          </button>
        </div>

        <div className="mt-4">
          <select
            value={selectedProductId ?? ''}
            onChange={(event) => setSelectedProductId(Number.parseInt(event.target.value, 10))}
            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title} (/{product.slug})
              </option>
            ))}
          </select>
        </div>

        {schemaBlocked && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Faltan migraciones 0005/0006 en D1. Variantes no disponible.
          </div>
        )}

        {msg && (
          <div
            className={cn(
              'mt-4 rounded-xl px-3 py-2 text-sm',
              msg.type === 'error' && 'bg-rose-500/10 text-rose-200',
              msg.type === 'success' && 'bg-emerald-500/10 text-emerald-200',
              msg.type === 'info' && 'bg-sky-500/10 text-sky-200'
            )}
          >
            {msg.text}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
          Crear variante {selectedProduct ? `para ${selectedProduct.title}` : ''}
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={form.sku}
            onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
            placeholder="SKU"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
          <input
            value={form.option_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, option_name: event.target.value }))
            }
            placeholder="option_name (ej: talla)"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
          <input
            value={form.option_value}
            onChange={(event) =>
              setForm((current) => ({ ...current, option_value: event.target.value }))
            }
            placeholder="option_value (ej: M)"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={form.price_cents}
            onChange={(event) =>
              setForm((current) => ({ ...current, price_cents: event.target.value }))
            }
            placeholder="price_cents (opcional)"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
          <input
            value={form.stock}
            onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
            placeholder="stock"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_active: event.target.checked }))
              }
            />
            Activa
          </label>
        </div>
        <button
          type="button"
          onClick={() => void createVariant()}
          disabled={!selectedProductId || saving || schemaBlocked}
          className={cn(
            'mt-4 rounded-xl px-4 py-2 text-sm font-semibold',
            !selectedProductId || saving || schemaBlocked
              ? 'cursor-not-allowed bg-surface200 text-zinc-500'
              : 'bg-brand text-black'
          )}
        >
          Crear variante
        </button>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
          Variantes existentes ({variants.length})
        </h3>
        <div className="mt-4 grid gap-3">
          {loading ? (
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-4 text-sm text-zinc-500">
              Cargando variantes...
            </div>
          ) : variants.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-4 text-sm text-zinc-500">
              No hay variantes para este producto.
            </div>
          ) : (
            variants.map((variant) => (
              <article
                key={variant.id}
                className="rounded-xl border border-white/5 bg-black/20 p-3"
              >
                {editingId === variant.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        value={edit.sku}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, sku: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={edit.option_name}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, option_name: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={edit.option_value}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, option_value: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        value={edit.price_cents}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, price_cents: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={edit.stock}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, stock: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={edit.is_active}
                          onChange={(event) =>
                            setEdit((current) => ({ ...current, is_active: event.target.checked }))
                          }
                        />
                        Activa
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-black"
                      >
                        <Save className="h-4 w-4" />
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEdit(EMPTY_FORM)
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{variant.sku}</p>
                      <span
                        className={cn(
                          'rounded-md px-2 py-1 text-xs',
                          variant.is_active === 1
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-zinc-500/20 text-zinc-300'
                        )}
                      >
                        {variant.is_active === 1 ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      {variant.option_name}: {variant.option_value}
                    </p>
                    <p className="text-xs text-zinc-500">
                      price_cents: {variant.price_cents ?? 'null'} | stock: {variant.stock}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(variant)}
                        className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteVariant(variant)}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
