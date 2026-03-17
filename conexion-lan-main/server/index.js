const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { nanoid } = require('nanoid')
const path = require('path')
const fs = require('fs')
const os = require('os')
const net = require('net')
const http = require('http')
const { exec } = require('child_process')
const { db, initDb } = require('./db')

const PORT = Number(process.env.PORT || 3005)
const UI_PORT = Number(process.env.UI_PORT || 5173)
const NODE_ENV = process.env.NODE_ENV || 'development'
const ONLINE_TTL_MS = 25 * 1000

initDb()

const app = express()
const SHARED_APP_KEY = 'equipo123'

if (NODE_ENV === 'development') app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use((req, res, next) => {
  const p = req.path || ''
  if (!p.startsWith('/api/')) return next()

  const rawKey = req.headers['x-app-key'] ?? req.query.appKey ?? ''
  const clientKey = Array.isArray(rawKey) ? rawKey[0] : String(rawKey)

  if (clientKey !== SHARED_APP_KEY) {
    return res.status(401).json({ error: 'No autorizado. Clave incorrecta.' })
  }

  next()
})

function now() {
  return Date.now()
}

function getClientIp(req) {
  const xfwd = (req.headers['x-forwarded-for'] || '').toString()
  const first = xfwd.split(',')[0]?.trim()
  const ra = req.socket?.remoteAddress || ''
  return (first || ra).replace(/^::ffff:/, '') || 'unknown'
}

function getClientIdentity(req, opts = {}) {
  const allowQuery = Boolean(opts.allowQuery)
  const idSource = allowQuery
    ? req.query?.clientId || req.headers['x-client-id']
    : req.headers['x-client-id']
  const nameSource = allowQuery
    ? req.query?.clientName || req.headers['x-client-name']
    : req.headers['x-client-name']
  const id = (idSource || '').toString().slice(0, 80).trim()
  const name = (nameSource || '').toString().slice(0, 80).trim()
  const ua = (req.headers['user-agent'] || '').toString().slice(0, 180)
  return {
    clientId: id || null,
    clientName: name || null,
    userAgent: ua || null
  }
}

function isLocalhost(req) {
  const ip = req.socket.remoteAddress || ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

function adminOnly(req, res, next) {
  if (!isLocalhost(req)) return res.status(403).json({ error: 'Admin solo localhost' })
  next()
}

const configPath = path.join(__dirname, 'config.json')
const distPath = path.join(__dirname, '..', 'client', 'dist')
const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

if (NODE_ENV !== 'development') {
  app.use(express.static(distPath, { index: false }))
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${nanoid(6)}-${file.originalname}`)
})
const upload = multer({ storage })

const stmtUpsertClient = db.prepare(`
  INSERT INTO clients (client_id, name, first_seen, last_seen, last_ip, user_agent)
  VALUES (@client_id, @name, @t, @t, @ip, @ua)
  ON CONFLICT(client_id) DO UPDATE SET
    name = COALESCE(excluded.name, clients.name),
    last_seen = excluded.last_seen,
    last_ip = excluded.last_ip,
    user_agent = COALESCE(excluded.user_agent, clients.user_agent)
`)
const stmtGetSession = db.prepare('SELECT id FROM sessions WHERE client_id = ? LIMIT 1')
const stmtInsertSession = db.prepare(`
  INSERT INTO sessions (client_id, ip, user_agent, first_seen, last_seen, last_ping, hits)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const stmtUpdateSession = db.prepare(`
  UPDATE sessions SET
    ip = ?,
    user_agent = COALESCE(?, user_agent),
    last_seen = ?,
    last_ping = CASE WHEN ? THEN ? ELSE last_ping END,
    hits = hits + 1
  WHERE client_id = ?
`)
const stmtInsertActivity = db.prepare(`
  INSERT INTO activity (client_id, client_name, ip, kind, path, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const stmtGetClientName = db.prepare('SELECT name FROM clients WHERE client_id = ?')
const noteSelectFields = `
  SELECT
    id,
    COALESCE(NULLIF(TRIM(title), ''), 'Sin titulo') AS title,
    content,
    COALESCE(pinned, 0) AS pinned,
    created_at AS createdAt,
    COALESCE(updated_at, created_at) AS updatedAt,
    client_id AS clientId,
    client_name AS clientName,
    ip
`
const stmtListNotes = db.prepare(`
  ${noteSelectFields}
  FROM notes
  ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, created_at DESC
  LIMIT 200
`)
const stmtInsertNote = db.prepare(`
  INSERT INTO notes (id, title, content, created_at, updated_at, client_id, client_name, ip, pinned)
  VALUES (@id, @title, @content, @createdAt, @updatedAt, @clientId, @clientName, @ip, 0)
`)
const stmtDeleteNote = db.prepare('DELETE FROM notes WHERE id = ?')
const stmtSetPinnedNote = db.prepare('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?')
const stmtListFiles = db.prepare(`
  SELECT id, original_name AS originalName, stored_name AS filename, size, created_at AS createdAt,
         client_id AS clientId, client_name AS clientName, ip
  FROM files
  ORDER BY created_at DESC
  LIMIT 200
`)
const stmtInsertFile = db.prepare(`
  INSERT INTO files (id, original_name, stored_name, size, created_at, client_id, client_name, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const stmtFindFileById = db.prepare(`
  SELECT id, original_name AS originalName, stored_name AS storedName
  FROM files
  WHERE id = ?
`)
const stmtInsertBroadcast = db.prepare(`
  INSERT INTO messages (id, kind, from_id, from_name, to_id, text, created_at)
  VALUES (?, 'broadcast', ?, ?, NULL, ?, ?)
`)
const stmtInsertDm = db.prepare(`
  INSERT INTO messages (id, kind, from_id, from_name, to_id, text, created_at, delivered_at)
  VALUES (?, 'dm', ?, ?, ?, ?, ?, NULL)
`)
const stmtMarkDeliveredById = db.prepare('UPDATE messages SET delivered_at = ? WHERE id = ?')
const stmtListUsers = db.prepare(`
  SELECT c.client_id AS clientId,
         c.name AS clientName,
         s.ip AS ip,
         s.last_seen AS lastSeen,
         s.last_ping AS lastPing,
         s.hits AS hits
  FROM clients c
  LEFT JOIN sessions s ON s.id = (
    SELECT s2.id
    FROM sessions s2
    WHERE s2.client_id = c.client_id
    ORDER BY s2.last_seen DESC
    LIMIT 1
  )
  ORDER BY COALESCE(s.last_seen, c.last_seen) DESC
  LIMIT 300
`)
const stmtVisitors = db.prepare(`
  SELECT
    a.ip AS ip,
    MIN(a.created_at) AS firstSeen,
    MAX(a.created_at) AS lastSeen,
    COUNT(*) AS hits,
    COALESCE((
      SELECT aa.path
      FROM activity aa
      WHERE aa.kind = 'hit' AND aa.ip = a.ip AND aa.path IS NOT NULL
      ORDER BY aa.created_at DESC
      LIMIT 1
    ), '') AS lastPath,
    (
      SELECT aa.client_id
      FROM activity aa
      WHERE aa.kind = 'hit' AND aa.ip = a.ip AND aa.client_id IS NOT NULL
      ORDER BY aa.created_at DESC
      LIMIT 1
    ) AS clientId,
    (
      SELECT aa.client_name
      FROM activity aa
      WHERE aa.kind = 'hit' AND aa.ip = a.ip AND aa.client_name IS NOT NULL
      ORDER BY aa.created_at DESC
      LIMIT 1
    ) AS clientName,
    COALESCE((
      SELECT s.user_agent
      FROM sessions s
      WHERE s.ip = a.ip
      ORDER BY s.last_seen DESC
      LIMIT 1
    ), '') AS userAgent
  FROM activity a
  WHERE a.kind = 'hit'
    AND a.ip IS NOT NULL
    AND a.ip != ''
    AND a.ip NOT IN ('127.0.0.1', '::1')
  GROUP BY a.ip
  ORDER BY lastSeen DESC
  LIMIT 500
`)
const stmtClearVisitors = db.prepare("DELETE FROM activity WHERE kind = 'hit'")
const stmtHistory = db.prepare(`
  SELECT id, kind AS type, from_id AS fromId, COALESCE(from_name, 'Sin nombre') AS fromName,
         to_id AS toId, text, created_at AS ts
  FROM messages
  WHERE kind = 'broadcast'
     OR from_id = ?
     OR (to_id = ? AND delivered_at IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 80
`)
const stmtPendingDm = db.prepare(`
  SELECT id, kind AS type, from_id AS fromId, COALESCE(from_name, 'Sin nombre') AS fromName,
         to_id AS toId, text, created_at AS ts
  FROM messages
  WHERE kind = 'dm' AND to_id = ? AND delivered_at IS NULL
  ORDER BY created_at ASC
  LIMIT 200
`)

function getSafeName(clientId, fallbackName) {
  if (fallbackName) return fallbackName
  const row = stmtGetClientName.get(clientId)
  return row?.name || 'Sin nombre'
}

function insertActivity(clientId, clientName, ip, kind, reqPath, createdAt) {
  stmtInsertActivity.run(
    clientId || null,
    clientName || null,
    ip || null,
    kind,
    reqPath || null,
    createdAt
  )
}

function upsertClientAndSession(req, kind = 'hit', opts = {}) {
  const ip = getClientIp(req)
  const { clientId, clientName, userAgent } = getClientIdentity(req, opts)
  if (!clientId) return { clientId: null, clientName: null, ip }

  const t = now()
  stmtUpsertClient.run({
    client_id: clientId,
    name: clientName || null,
    t,
    ip,
    ua: userAgent || null
  })

  const existing = stmtGetSession.get(clientId)
  if (!existing) {
    stmtInsertSession.run(clientId, ip, userAgent || null, t, t, kind === 'ping' ? t : null, 1)
  } else {
    stmtUpdateSession.run(ip, userAgent || null, t, kind === 'ping' ? 1 : 0, t, clientId)
  }

  if (!opts.skipActivity) {
    const reqPath = `${req.method} ${req.originalUrl || req.url || ''}`.slice(0, 200)
    insertActivity(clientId, clientName, ip, kind, reqPath, t)
  }

  return { clientId, clientName, ip }
}

app.use((req, _res, next) => {
  const p = req.path || ''
  if (!p.startsWith('/assets/') && p !== '/favicon.ico' && p !== '/api/ping') {
    upsertClientAndSession(req, 'hit')
  }
  next()
})

function getIPv4List() {
  const nets = os.networkInterfaces()
  const out = []
  for (const name of Object.keys(nets)) {
    for (const netif of nets[name] || []) {
      if (netif.family === 'IPv4' && !netif.internal) {
        out.push({ name, address: netif.address })
      }
    }
  }
  return out
}

function readConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return {
      port: Number(cfg.port || PORT),
      uiPort: Number(cfg.uiPort || UI_PORT),
      mode: (cfg.mode || 'all').toString(),
      lanHost: (cfg.lanHost || '').toString(),
      advertiseIp: (cfg.advertiseIp || '').toString()
    }
  } catch {
    return { port: Number(PORT), uiPort: UI_PORT, mode: 'all', lanHost: '', advertiseIp: '' }
  }
}

function writeConfig(nextCfg) {
  fs.writeFileSync(configPath, JSON.stringify(nextCfg, null, 2), 'utf-8')
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', () => resolve(false))
    srv.listen({ port, host: '0.0.0.0' }, () => {
      srv.close(() => resolve(true))
    })
  })
}

// ---------- ADMIN API (solo localhost) ----------
app.get('/api/admin/network', adminOnly, (_req, res) => {
  const ips = getIPv4List()
  const cfg = readConfig()
  const advertiseIp =
    cfg.advertiseIp && ips.some((x) => x.address === cfg.advertiseIp)
      ? cfg.advertiseIp
      : ips.find((x) => x.address.startsWith('192.168.'))?.address || ips[0]?.address || null

  res.json({
    hostname: os.hostname(),
    ips,
    port: Number(PORT),
    mode: cfg.mode || 'all',
    lanHost: cfg.lanHost || null,
    advertiseIp,
    links: advertiseIp
      ? {
          app: `http://${advertiseIp}:${Number(PORT)}`
        }
      : { app: null }
  })
})

app.get('/api/admin/ports', adminOnly, (_req, res) => {
  exec('netstat -ano -p tcp', { windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'No pude ejecutar netstat' })

    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const listening = lines
      .filter((l) => /\sLISTENING\s/i.test(l))
      .map((l) => {
        const parts = l.split(/\s+/)
        const proto = parts[0]
        const local = parts[1] || ''
        const foreign = parts[2] || ''
        const state = parts[3] || ''
        const pid = parts[4] || ''
        return { proto, local, foreign, state, pid }
      })

    res.json({ count: listening.length, listening })
  })
})

app.get('/api/admin/port-check/:port', adminOnly, (req, res) => {
  const port = String(req.params.port).replace(/[^\d]/g, '')
  if (!port) return res.status(400).json({ error: 'Puerto invalido' })

  exec(
    `netstat -ano | findstr :${port}`,
    { windowsHide: true, maxBuffer: 256 * 1024 },
    (_err, stdout) => {
      const raw = (stdout || '').trim()
      const inUse = raw.length > 0
      res.json({ port: Number(port), inUse, raw })
    }
  )
})

app.get('/api/admin/suggest-ports', adminOnly, async (req, res) => {
  const candidatesRaw =
    req.query.candidates?.toString() ||
    '3001,3005,3010,3050,4000,5000,5050,7001,8088,9000,9010,10080'

  const candidates = candidatesRaw
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535)

  const checks = await Promise.all(
    candidates.map(async (p) => ({ port: p, free: await checkPortFree(p) }))
  )

  res.json({
    current: Number(PORT),
    suggested: checks.filter((x) => x.free).map((x) => x.port),
    detail: checks
  })
})

app.post('/api/admin/set-port', adminOnly, async (req, res) => {
  const port = Number(req.body?.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'Puerto invalido' })
  }

  const free = await checkPortFree(port)
  if (!free) return res.status(409).json({ error: 'Puerto en uso', port })

  const cfg = readConfig()
  const nextCfg = { ...cfg, port }
  writeConfig(nextCfg)

  return res.json({ ok: true, applied: nextCfg })
})

app.post('/api/admin/set-bind', adminOnly, (req, res) => {
  const mode = (req.body?.mode ?? 'all').toString()
  const lanHost = (req.body?.lanHost ?? '').toString().trim()
  const advertiseIp = (req.body?.advertiseIp ?? '').toString().trim()
  const ips = getIPv4List().map((x) => x.address)

  if (!['all', 'lan_only'].includes(mode)) {
    return res.status(400).json({ error: 'mode invalido' })
  }
  if (mode === 'lan_only' && !ips.includes(lanHost)) {
    return res.status(400).json({ error: 'lanHost invalida (no existe en interfaces)' })
  }
  if (advertiseIp && !ips.includes(advertiseIp)) {
    return res.status(400).json({ error: 'advertiseIp invalida' })
  }

  const cfg = readConfig()
  const nextCfg = {
    ...cfg,
    mode,
    lanHost: mode === 'lan_only' ? lanHost : cfg.lanHost || lanHost,
    advertiseIp: advertiseIp || cfg.advertiseIp || ''
  }
  writeConfig(nextCfg)
  return res.json({ ok: true, applied: nextCfg })
})

app.get('/api/admin/visitors', adminOnly, (req, res) => {
  const t = now()
  const queryMinutes = Number(req.query.activeMinutes || 5)
  const activeMinutes = Number.isFinite(queryMinutes) ? Math.max(1, queryMinutes) : 5
  const activeMs = activeMinutes * 60 * 1000

  const visitors = stmtVisitors.all().map((v) => ({
    ...v,
    isActive: t - v.lastSeen <= activeMs
  }))

  res.json({
    total: visitors.length,
    activeMinutes,
    active: visitors.filter((x) => x.isActive).length,
    visitors
  })
})

app.post('/api/admin/visitors/clear', adminOnly, (_req, res) => {
  stmtClearVisitors.run()
  res.json({ ok: true })
})

app.get('/api/admin/users', adminOnly, (_req, res) => {
  const t = now()
  const users = stmtListUsers.all().map((u) => ({
    ...u,
    ip: u.ip || 'unknown',
    online: u.lastPing ? t - u.lastPing <= ONLINE_TTL_MS : false
  }))

  const counts = new Map()
  for (const u of users) {
    const key = (u.clientName || '').trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const duplicates = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([nameKey, count]) => ({ nameKey, count }))

  res.json({ users, duplicates, total: users.length })
})

app.get('/api/admin/chat/messages', adminOnly, (req, res) => {
  const rawLimit = Number(req.query.limit || 100)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 100, 1), 500)
  const beforeRaw = Number(req.query.before || 0)
  const before = Number.isFinite(beforeRaw) ? beforeRaw : 0
  const kind = (req.query.kind || '').toString()
  const q = (req.query.q || '').toString().trim()
  const fromId = (req.query.fromId || '').toString().trim()
  const toId = (req.query.toId || '').toString().trim()

  const where = []
  const params = {}

  if (before > 0) {
    where.push('created_at < @before')
    params.before = before
  }
  if (kind === 'broadcast' || kind === 'dm') {
    where.push('kind = @kind')
    params.kind = kind
  }
  if (fromId) {
    where.push('from_id = @fromId')
    params.fromId = fromId
  }
  if (toId) {
    where.push('to_id = @toId')
    params.toId = toId
  }
  if (q) {
    where.push('text LIKE @q')
    params.q = `%${q}%`
  }

  params.limit = limit

  const sql = `
    SELECT id,
           kind AS type,
           from_id AS fromId,
           COALESCE(from_name,'Sin nombre') AS fromName,
           to_id AS toId,
           text,
           created_at AS ts,
           delivered_at AS deliveredAt,
           read_at AS readAt
    FROM messages
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT @limit
  `

  const rows = db.prepare(sql).all(params)
  const nextCursor = rows.length ? rows[rows.length - 1].ts : null
  res.json({ rows, nextCursor })
})

app.get('/api/admin/chat/export.csv', adminOnly, (req, res) => {
  const sinceRaw = Number(req.query.since || 0)
  const untilRaw = Number(req.query.until || 0)
  const since = Number.isFinite(sinceRaw) ? sinceRaw : 0
  const until = Number.isFinite(untilRaw) ? untilRaw : 0

  const where = []
  const params = {}
  if (since > 0) {
    where.push('created_at >= @since')
    params.since = since
  }
  if (until > 0) {
    where.push('created_at <= @until')
    params.until = until
  }

  const rows = db
    .prepare(
      `
    SELECT kind, from_id, COALESCE(from_name, '') AS from_name,
           COALESCE(to_id, '') AS to_id, text, created_at
    FROM messages
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at ASC
  `
    )
    .all(params)

  const esc = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const header = 'kind,from_id,from_name,to_id,text,created_at\n'
  const body = rows
    .map((row) =>
      [row.kind, row.from_id, row.from_name, row.to_id, row.text, row.created_at].map(esc).join(',')
    )
    .join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=chat_export.csv')
  res.send(header + body)
})

app.post('/api/admin/chat/purge', adminOnly, (req, res) => {
  const rawDays = Number(req.body?.olderThanDays || 30)
  const olderThanDays = Number.isFinite(rawDays) ? Math.max(1, rawDays) : 30
  const cutoff = now() - olderThanDays * 24 * 60 * 60 * 1000

  const info = db.prepare('DELETE FROM messages WHERE created_at < ?').run(cutoff)
  res.json({ ok: true, deleted: info.changes, cutoff, olderThanDays })
})

app.post('/api/ping', (req, res) => {
  upsertClientAndSession(req, 'ping')
  res.json({ ok: true, t: now() })
})

// ====== API Usuarios (Publica para autocompletado del chat) ======
app.get('/api/users', (_req, res) => {
  const t = now()
  const users = stmtListUsers.all().map((u) => ({
    clientId: u.clientId,
    clientName: u.clientName || 'Sin nombre',
    online: u.lastPing ? t - u.lastPing <= ONLINE_TTL_MS : false
  }))
  res.json(users)
})

// ====== API Notas ======
app.get('/api/notes', (_req, res) => {
  res.json(stmtListNotes.all())
})

app.get('/api/notes/top', (_req, res) => {
  const pinned = db
    .prepare(
      `
    ${noteSelectFields}
    FROM notes
    WHERE pinned = 1
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 20
  `
    )
    .all()

  const latest = db
    .prepare(
      `
    ${noteSelectFields}
    FROM notes
    WHERE pinned = 0
    ORDER BY createdAt DESC
    LIMIT 5
  `
    )
    .all()

  res.json({ pinned, latest })
})

app.get('/api/notes/search', (req, res) => {
  const q = (req.query.q || '').toString().trim()
  const page = Math.max(1, Number(req.query.page || 1) || 1)
  const pageSize = 10
  const offset = (page - 1) * pageSize

  const where = []
  const params = {
    limit: pageSize,
    offset
  }

  if (q) {
    where.push(
      "(COALESCE(title, '') LIKE @q OR content LIKE @q OR COALESCE(client_name, '') LIKE @q)"
    )
    params.q = `%${q}%`
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const totalRow = db
    .prepare(
      `
    SELECT COUNT(*) AS c
    FROM notes
    ${whereSql}
  `
    )
    .get(params)

  const total = totalRow?.c || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const rows = db
    .prepare(
      `
    ${noteSelectFields}
    FROM notes
    ${whereSql}
    ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC
    LIMIT @limit OFFSET @offset
  `
    )
    .all(params)

  res.json({ q, page, pageSize, total, totalPages, rows })
})

app.post('/api/notes', (req, res) => {
  const titleRaw = (req.body?.title ?? '').toString().trim()
  const contentRaw = (req.body?.content ?? '').toString().trim()

  const title = titleRaw.slice(0, 60)
  const content = contentRaw

  if (!title) return res.status(400).json({ error: 'title requerido (max 60)' })
  if (!content) return res.status(400).json({ error: 'content requerido' })

  const ip = getClientIp(req)
  const { clientId, clientName } = getClientIdentity(req)
  const t = now()

  const note = {
    id: nanoid(10),
    title,
    content,
    pinned: 0,
    createdAt: t,
    updatedAt: t,
    clientId: clientId || null,
    clientName: clientName || null,
    ip
  }

  stmtInsertNote.run(note)
  if (clientId) insertActivity(clientId, clientName, ip, 'note', null, t)
  res.json(note)
})

app.delete('/api/notes/:id', (req, res) => {
  stmtDeleteNote.run(req.params.id)
  res.json({ ok: true })
})

app.post('/api/admin/notes/pin', adminOnly, (req, res) => {
  const id = (req.body?.id ?? '').toString().trim()
  const pinned = req.body?.pinned ? 1 : 0
  const t = now()

  if (!id) return res.status(400).json({ error: 'id requerido' })

  stmtSetPinnedNote.run(pinned, t, id)
  res.json({ ok: true })
})

// ====== API Archivos ======
app.get('/api/files', (_req, res) => {
  res.json(stmtListFiles.all())
})

app.post('/api/files', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file requerido' })

  const ip = getClientIp(req)
  const { clientId, clientName } = getClientIdentity(req)
  const createdAt = now()
  const id = nanoid(10)

  stmtInsertFile.run(
    id,
    req.file.originalname,
    req.file.filename,
    req.file.size,
    createdAt,
    clientId || null,
    clientName || null,
    ip
  )

  if (clientId) insertActivity(clientId, clientName, ip, 'file', null, createdAt)

  res.json({
    id,
    originalName: req.file.originalname,
    filename: req.file.filename,
    size: req.file.size,
    createdAt,
    clientId: clientId || null,
    clientName: clientName || null,
    ip
  })
})

app.get('/api/files/:id/download', (req, res) => {
  const file = stmtFindFileById.get(req.params.id)
  if (!file) return res.status(404).send('Not found')
  res.download(path.join(uploadDir, file.storedName), file.originalName)
})

// ====== Auto-limpieza de Archivos (TTL) ======
const FILE_TTL_MS = 24 * 60 * 60 * 1000
const stmtGetOldFiles = db.prepare('SELECT id, stored_name FROM files WHERE created_at < ?')
const stmtDeleteFileById = db.prepare('DELETE FROM files WHERE id = ?')

function cleanupOldFiles() {
  const cutoff = now() - FILE_TTL_MS
  const oldFiles = stmtGetOldFiles.all(cutoff)

  for (const file of oldFiles) {
    stmtDeleteFileById.run(file.id)

    const filePath = path.join(uploadDir, file.stored_name)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        console.log(`[cleanup] Archivo eliminado por antiguedad: ${file.stored_name}`)
      } catch (err) {
        console.error(`[cleanup] Error al eliminar archivo ${file.stored_name}:`, err)
      }
    }
  }
}

setInterval(cleanupOldFiles, 60 * 60 * 1000)
cleanupOldFiles()

// ====== Chat SSE + DM offline ======
const chatClients = new Map()
// clientId -> response

function sendSse(stream, event, data) {
  stream.write(`event: ${event}\n`)
  stream.write(`data: ${JSON.stringify(data)}\n\n`)
}

app.get('/api/chat/stream', (req, res) => {
  const { clientId, clientName } = getClientIdentity(req, { allowQuery: true })
  if (!clientId) return res.status(400).end('Missing clientId')

  upsertClientAndSession(req, 'hit', { allowQuery: true })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const keepAlive = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n')
    } catch {}
  }, 15000)

  const prev = chatClients.get(clientId)
  if (prev && prev !== res) {
    try {
      prev.end()
    } catch {}
  }
  chatClients.set(clientId, res)

  const history = stmtHistory.all(clientId, clientId).reverse()
  sendSse(res, 'history', history)

  const pending = stmtPendingDm.all(clientId)
  if (pending.length > 0) {
    for (const message of pending) {
      sendSse(res, 'dm', message)
      stmtMarkDeliveredById.run(now(), message.id)
    }
  }

  sendSse(res, 'hello', {
    ok: true,
    you: { clientId, clientName: getSafeName(clientId, clientName) }
  })

  req.on('close', () => {
    clearInterval(keepAlive)
    if (chatClients.get(clientId) === res) chatClients.delete(clientId)
  })
})

app.post('/api/chat/send', (req, res) => {
  const { clientId, clientName } = getClientIdentity(req)
  if (!clientId) return res.status(400).json({ error: 'Missing x-client-id' })

  const text = (req.body?.text ?? '').toString().trim()
  if (!text) return res.status(400).json({ error: 'text requerido' })

  upsertClientAndSession(req, 'chat')

  const t = now()
  const msg = {
    id: nanoid(10),
    type: 'broadcast',
    fromId: clientId,
    fromName: getSafeName(clientId, clientName),
    text: text.slice(0, 2000),
    ts: t
  }

  stmtInsertBroadcast.run(msg.id, msg.fromId, msg.fromName, msg.text, t)

  for (const stream of chatClients.values()) {
    try {
      sendSse(stream, 'message', msg)
    } catch {}
  }

  res.json({ ok: true })
})

app.post('/api/chat/dm', (req, res) => {
  const { clientId, clientName } = getClientIdentity(req)
  if (!clientId) return res.status(400).json({ error: 'Missing x-client-id' })

  const toId = (req.body?.toId ?? '').toString().trim()
  const text = (req.body?.text ?? '').toString().trim()
  if (!toId || !text) return res.status(400).json({ error: 'toId y text requeridos' })

  upsertClientAndSession(req, 'dm')

  const t = now()
  const msg = {
    id: nanoid(10),
    type: 'dm',
    fromId: clientId,
    fromName: getSafeName(clientId, clientName),
    toId,
    text: text.slice(0, 2000),
    ts: t
  }

  stmtInsertDm.run(msg.id, msg.fromId, msg.fromName, msg.toId, msg.text, t)

  let delivered = false
  const target = chatClients.get(toId)
  if (target) {
    try {
      sendSse(target, 'dm', msg)
      stmtMarkDeliveredById.run(now(), msg.id)
      delivered = true
    } catch {}
  }

  const me = chatClients.get(clientId)
  if (me && me !== target) {
    try {
      sendSse(me, 'dm', msg)
    } catch {}
  }

  res.json({ ok: true, delivered })
})

if (NODE_ENV !== 'development') {
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

const cfgBoot = readConfig()
const mode = cfgBoot.mode || 'all'
const lanHost = cfgBoot.lanHost || '192.168.0.158'

const servers = []
const socketsByServer = new Map()

function trackSockets(server) {
  const set = new Set()
  socketsByServer.set(server, set)
  server.on('connection', (socket) => {
    set.add(socket)
    socket.on('close', () => set.delete(socket))
  })
}

function startServer(host) {
  const srv = http.createServer(app)
  trackSockets(srv)
  srv.listen(PORT, host, () => {
    console.log(`[server] Listening on http://${host}:${PORT} (env=${NODE_ENV})`)
  })
  servers.push(srv)
}

if (mode === 'lan_only') {
  startServer('127.0.0.1')
  if (lanHost && lanHost !== '127.0.0.1') startServer(lanHost)
} else {
  startServer('0.0.0.0')
}

let shuttingDown = false
async function shutdown(reason) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] ${reason}`)

  await Promise.all(
    servers.map(
      (srv) =>
        new Promise((resolve) => {
          try {
            srv.close(() => resolve())
          } catch {
            resolve()
          }
        })
    )
  )

  for (const srv of servers) {
    const set = socketsByServer.get(srv)
    if (!set) continue
    for (const socket of set) {
      try {
        socket.destroy()
      } catch {}
    }
  }

  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  shutdown('uncaughtException')
})
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err)
  shutdown('unhandledRejection')
})
