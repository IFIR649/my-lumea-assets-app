import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, RefreshCw, Save, Trash2, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type ProductLite = {
  id: number
  title: string
  slug: string
}

type Review = {
  id: number
  product_id: number
  author_name: string
  rating: number
  title: string | null
  body: string | null
  verified_purchase: number
  is_published: number
  created_at: string
}

type ReviewForm = {
  author_name: string
  rating: string
  title: string
  body: string
  verified_purchase: boolean
  is_published: boolean
}

type ReviewsFilter = 'all' | 'published' | 'draft'

type ReviewsManagerProps = {
  products: ProductLite[]
}

const EMPTY_FORM: ReviewForm = {
  author_name: '',
  rating: '5',
  title: '',
  body: '',
  verified_purchase: false,
  is_published: false
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!res.ok) {
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const errorMessage = String((payload as { error?: unknown }).error || '').trim()
      throw new Error(errorMessage || `HTTP ${res.status}`)
    }
    throw new Error(typeof payload === 'string' && payload ? payload : `HTTP ${res.status}`)
  }

  return payload as T
}

function isSchemaNotReadyError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('schema_not_ready') || normalized.includes('faltan migraciones 0005/0006')
  )
}

function parseRating(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null
  return parsed
}

function formatDate(value: string): string {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function ReviewsManager({ products }: ReviewsManagerProps): React.JSX.Element {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(products[0]?.id ?? null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [schemaBlocked, setSchemaBlocked] = useState(false)
  const [filter, setFilter] = useState<ReviewsFilter>('all')
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [edit, setEdit] = useState<ReviewForm>(EMPTY_FORM)

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  )

  const filteredReviews = useMemo(() => {
    if (filter === 'published') return reviews.filter((review) => review.is_published === 1)
    if (filter === 'draft') return reviews.filter((review) => review.is_published !== 1)
    return reviews
  }, [filter, reviews])

  useEffect(() => {
    if (!products.length) {
      setSelectedProductId(null)
      setReviews([])
      return
    }
    if (
      selectedProductId === null ||
      !products.some((product) => product.id === selectedProductId)
    ) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  const loadReviews = async (): Promise<void> => {
    if (!selectedProductId) return
    setLoading(true)
    try {
      const payload = await requestJson<{
        success: boolean
        reviews?: Review[]
        code?: string
        error?: string
      }>(`/api/products/${selectedProductId}/reviews`)
      if (!payload.success) {
        throw new Error(payload.error || 'No se pudieron cargar resenas.')
      }
      setReviews(payload.reviews || [])
      setSchemaBlocked(false)
      setMsg(null)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Error desconocido'
      if (isSchemaNotReadyError(text)) {
        setSchemaBlocked(true)
        setReviews([])
        setMsg({
          type: 'error',
          text: 'Faltan migraciones 0005/0006 en D1 para gestionar resenas.'
        })
      } else {
        setMsg({ type: 'error', text })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId])

  const createReview = async (): Promise<void> => {
    if (!selectedProductId || schemaBlocked) return
    const rating = parseRating(form.rating)
    const authorName = form.author_name.trim()

    if (!authorName) return setMsg({ type: 'error', text: 'author_name es obligatorio.' })
    if (rating === null) return setMsg({ type: 'error', text: 'rating invalido (1 a 5).' })

    setSaving(true)
    setMsg({ type: 'info', text: 'Creando resena...' })
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/reviews`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author_name: authorName,
            rating,
            title: form.title.trim() || undefined,
            body: form.body.trim() || undefined,
            verified_purchase: form.verified_purchase ? 1 : 0,
            is_published: form.is_published ? 1 : 0
          })
        }
      )
      if (!payload.success) throw new Error(payload.error || 'No se pudo crear resena.')
      setForm(EMPTY_FORM)
      await loadReviews()
      setMsg({ type: 'success', text: 'Resena creada.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error creando resena.'
      })
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (review: Review): void => {
    setEditingId(review.id)
    setEdit({
      author_name: review.author_name,
      rating: String(review.rating),
      title: review.title || '',
      body: review.body || '',
      verified_purchase: review.verified_purchase === 1,
      is_published: review.is_published === 1
    })
  }

  const saveEdit = async (): Promise<void> => {
    if (!selectedProductId || !editingId || schemaBlocked) return
    const rating = parseRating(edit.rating)
    const authorName = edit.author_name.trim()
    if (!authorName) return setMsg({ type: 'error', text: 'author_name es obligatorio.' })
    if (rating === null) return setMsg({ type: 'error', text: 'rating invalido (1 a 5).' })

    setSaving(true)
    setMsg({ type: 'info', text: 'Actualizando resena...' })
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/reviews/${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author_name: authorName,
            rating,
            title: edit.title.trim() || '',
            body: edit.body.trim() || '',
            verified_purchase: edit.verified_purchase ? 1 : 0,
            is_published: edit.is_published ? 1 : 0
          })
        }
      )
      if (!payload.success) throw new Error(payload.error || 'No se pudo actualizar resena.')
      setEditingId(null)
      setEdit(EMPTY_FORM)
      await loadReviews()
      setMsg({ type: 'success', text: 'Resena actualizada.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error actualizando resena.'
      })
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (review: Review): Promise<void> => {
    if (!selectedProductId || schemaBlocked) return
    const nextPublished = review.is_published === 1 ? 0 : 1
    setSaving(true)
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/reviews/${review.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_published: nextPublished })
        }
      )
      if (!payload.success)
        throw new Error(payload.error || 'No se pudo cambiar estado de publicacion.')
      await loadReviews()
      setMsg({
        type: 'success',
        text: nextPublished === 1 ? 'Resena publicada.' : 'Resena despublicada.'
      })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error cambiando publicacion.'
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteReview = async (review: Review): Promise<void> => {
    if (!selectedProductId || schemaBlocked) return
    if (!window.confirm(`Eliminar resena de ${review.author_name}?`)) return
    setSaving(true)
    try {
      const payload = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${selectedProductId}/reviews/${review.id}`,
        { method: 'DELETE' }
      )
      if (!payload.success) throw new Error(payload.error || 'No se pudo eliminar resena.')
      if (editingId === review.id) {
        setEditingId(null)
        setEdit(EMPTY_FORM)
      }
      await loadReviews()
      setMsg({ type: 'success', text: 'Resena eliminada.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error eliminando resena.'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Resenas por producto</h2>
          <button
            type="button"
            onClick={() => void loadReviews()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold"
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Recargar
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
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
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ReviewsFilter)}
            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            <option value="published">Publicadas</option>
            <option value="draft">Borrador</option>
          </select>
        </div>

        {schemaBlocked && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Faltan migraciones 0005/0006 en D1. Resenas no disponible.
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
          Crear resena {selectedProduct ? `para ${selectedProduct.title}` : ''}
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={form.author_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, author_name: event.target.value }))
            }
            placeholder="author_name"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
          <input
            value={form.rating}
            onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}
            placeholder="rating (1-5)"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="title (opcional)"
            className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.body}
          onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
          placeholder="body (opcional)"
          rows={3}
          className="mt-3 w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.verified_purchase}
              onChange={(event) =>
                setForm((current) => ({ ...current, verified_purchase: event.target.checked }))
              }
            />
            Compra verificada
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_published: event.target.checked }))
              }
            />
            Publicar al crear
          </label>
        </div>
        <button
          type="button"
          onClick={() => void createReview()}
          disabled={!selectedProductId || saving || schemaBlocked}
          className={cn(
            'mt-4 rounded-xl px-4 py-2 text-sm font-semibold',
            !selectedProductId || saving || schemaBlocked
              ? 'cursor-not-allowed bg-surface200 text-zinc-500'
              : 'bg-brand text-black'
          )}
        >
          Crear resena
        </button>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
          Resenas existentes ({filteredReviews.length})
        </h3>
        <div className="mt-4 grid gap-3">
          {loading ? (
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-4 text-sm text-zinc-500">
              Cargando resenas...
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-4 text-sm text-zinc-500">
              No hay resenas para este filtro.
            </div>
          ) : (
            filteredReviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
                {editingId === review.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        value={edit.author_name}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, author_name: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={edit.rating}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, rating: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={edit.title}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, title: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      value={edit.body}
                      onChange={(event) =>
                        setEdit((current) => ({ ...current, body: event.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={edit.verified_purchase}
                          onChange={(event) =>
                            setEdit((current) => ({
                              ...current,
                              verified_purchase: event.target.checked
                            }))
                          }
                        />
                        Compra verificada
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={edit.is_published}
                          onChange={(event) =>
                            setEdit((current) => ({
                              ...current,
                              is_published: event.target.checked
                            }))
                          }
                        />
                        Publicada
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
                      <p className="font-semibold">{review.author_name}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
                          rating: {review.rating}
                        </span>
                        <span
                          className={cn(
                            'rounded-md px-2 py-1 text-xs',
                            review.is_published === 1
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-zinc-500/20 text-zinc-300'
                          )}
                        >
                          {review.is_published === 1 ? 'Publicada' : 'Borrador'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Creada: {formatDate(review.created_at)}
                    </p>
                    {review.title && <p className="mt-2 text-sm text-zinc-200">{review.title}</p>}
                    {review.body && <p className="mt-1 text-sm text-zinc-400">{review.body}</p>}
                    <p className="mt-1 text-xs text-zinc-500">
                      Compra verificada: {review.verified_purchase === 1 ? 'Si' : 'No'}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(review)}
                        className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePublish(review)}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-200"
                      >
                        <Check className="h-4 w-4" />
                        {review.is_published === 1 ? 'Despublicar' : 'Publicar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteReview(review)}
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
