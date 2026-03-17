import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { apiFetch, chatApi, type ChatMsg } from '../lib/api'
import { getClientId, getClientName } from '../lib/identity'
import { Avatar } from './Avatar'
import { Card, CardBody, CardHeader } from './Card'
import { EmojiPicker } from './EmojiPicker'

type ToastFn = (kind: 'success' | 'error' | 'info', msg: string) => void

type ChatUser = {
  clientId: string
  clientName: string
  online: boolean
}

function readSseData<T>(ev: Event): T | null {
  const msg = ev as MessageEvent<string>
  if (typeof msg.data !== 'string') return null
  try {
    return JSON.parse(msg.data) as T
  } catch {
    return null
  }
}

export function ChatPanel({ toast }: { toast: ToastFn }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)

  const myId = useMemo(() => getClientId(), [])
  const myName = useMemo(() => getClientName().trim(), [])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true

    async function fetchUsers() {
      try {
        const res = await apiFetch('/api/users')
        if (!res.ok) return

        const data = (await res.json()) as ChatUser[]
        if (!alive) return

        setUsers(
          data
            .filter((u) => u.clientId !== myId)
            .map((u) => ({
              clientId: u.clientId,
              clientName: (u.clientName || 'Sin nombre').trim() || 'Sin nombre',
              online: Boolean(u.online)
            }))
        )
      } catch {
        // noop
      }
    }

    fetchUsers()
    const t = setInterval(fetchUsers, 10000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [myId])

  useEffect(() => {
    const es = new EventSource(chatApi.streamUrl())

    const onHistory = (ev: Event) => {
      const data = readSseData<ChatMsg[]>(ev)
      if (!Array.isArray(data)) return
      setMsgs(data.slice(-200))
    }

    const onMessage = (ev: Event) => {
      const data = readSseData<ChatMsg>(ev)
      if (!data) return
      setMsgs((prev) => [...prev, data].slice(-200))
    }

    es.addEventListener('history', onHistory)
    es.addEventListener('message', onMessage)
    es.addEventListener('dm', onMessage)

    return () => {
      es.removeEventListener('history', onHistory)
      es.removeEventListener('message', onMessage)
      es.removeEventListener('dm', onMessage)
      es.close()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setText(val)

    const words = val.split(' ')
    const lastWord = words[words.length - 1] || ''

    if (lastWord.startsWith('@')) {
      setMentionFilter(lastWord.slice(1).toLowerCase())
      setShowMentions(true)
    } else {
      setShowMentions(false)
      setMentionFilter('')
    }
  }

  function selectUser(name: string) {
    const words = text.split(' ')
    words.pop()
    words.push(`@${name} `)
    setText(words.join(' '))
    setShowMentions(false)
    setMentionFilter('')
    inputRef.current?.focus()
  }

  async function send() {
    const value = text.trim()
    if (!value) return

    try {
      if (value.startsWith('@')) {
        const valueLc = value.toLowerCase()
        const targetUser = users.find((u) => valueLc.startsWith(`@${u.clientName.toLowerCase()} `))

        if (targetUser) {
          const prefixLen = targetUser.clientName.length + 2
          const dmText = value.slice(prefixLen).trim()

          if (!dmText) {
            toast('info', 'Escribe un mensaje para enviarle.')
            return
          }

          const result = await chatApi.dm(targetUser.clientId, dmText)
          setText('')
          setShowMentions(false)
          setMentionFilter('')
          setEmojiOpen(false)
          toast(
            'success',
            result.delivered ? 'Susurro enviado.' : 'Susurro guardado (destino no conectado).'
          )
          return
        }
      }

      await chatApi.send(value)
      setText('')
      setShowMentions(false)
      setMentionFilter('')
      setEmojiOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error'
      toast('error', `No pude enviar: ${message}`)
    }
  }

  const filteredUsers = users
    .filter((u) => u.clientName.toLowerCase().includes(mentionFilter))
    .slice(0, 5)

  return (
    <Card>
      <CardHeader
        title="Chat del Equipo (LAN)"
        subtitle="Usa @NombreUsuario al inicio del mensaje para enviar un susurro."
      />
      <CardBody>
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Aviso: mensajes auditables por el administrador local. Si no es DM, cualquiera puede
          verlo.
        </div>

        <div className="h-[360px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white/60 p-3">
          {msgs.map((m) => {
            const mine = m.fromId === myId
            const isDm = m.type === 'dm'
            const mentionsMe = Boolean(myName) && m.text.includes(`@${myName}`)

            return (
              <div
                key={`${m.id}-${m.ts}`}
                className={mine ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] rounded-2xl border bg-white/80 p-3 ${mine ? 'border-slate-300' : 'border-slate-200'}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar id={m.fromId} name={m.fromName} size={28} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {m.fromName}
                        </div>
                        {isDm ? (
                          <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
                            Susurro
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(m.ts).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div
                    className={[
                      'mt-2 whitespace-pre-wrap break-words text-sm',
                      mentionsMe ? 'font-semibold text-sky-700' : 'text-slate-900'
                    ].join(' ')}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="relative mt-3 flex gap-2">
          {showMentions && filteredUsers.length > 0 ? (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Mencionar a...
              </div>

              {filteredUsers.map((u) => (
                <button
                  key={u.clientId}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                  onClick={() => selectUser(u.clientName)}
                  type="button"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${u.online ? 'bg-emerald-400' : 'bg-slate-300'}`}
                  />
                  <span className="font-semibold text-slate-700">{u.clientName}</span>
                </button>
              ))}
            </div>
          ) : null}

          <input
            ref={inputRef}
            className="flex-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-400"
            value={text}
            onChange={handleTextChange}
            placeholder="Escribe un mensaje o un @susurro..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (showMentions && filteredUsers.length > 0) {
                  e.preventDefault()
                  selectUser(filteredUsers[0].clientName)
                } else {
                  send()
                }
              }
            }}
          />

          <button
            className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
            onClick={() => setEmojiOpen((prev) => !prev)}
            title="Emojis"
            type="button"
          >
            😀
          </button>

          <button
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={send}
            type="button"
          >
            Enviar
          </button>

          <EmojiPicker
            open={emojiOpen}
            onPick={(emoji) => {
              setText((prev) => prev + emoji)
              setEmojiOpen(false)
              inputRef.current?.focus()
            }}
          />
        </div>
      </CardBody>
    </Card>
  )
}
