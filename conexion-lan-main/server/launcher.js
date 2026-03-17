const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const configPath = path.join(__dirname, 'config.json')

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const cfg = JSON.parse(raw)
    return {
      port: Number(cfg.port || 3005),
      uiPort: Number(cfg.uiPort || 5173),
      mode: (cfg.mode || 'all').toString(),
      lanHost: (cfg.lanHost || '').toString(),
      advertiseIp: (cfg.advertiseIp || '').toString()
    }
  } catch {
    return { port: 3005, uiPort: 5173, mode: 'all', lanHost: '', advertiseIp: '' }
  }
}

let child = null
let last = { port: null, mode: null, lanHost: null }

function startChild() {
  const cfg = readConfig()
  last = { port: cfg.port, mode: cfg.mode || 'all', lanHost: cfg.lanHost || '' }

  console.log(
    `[launcher] Starting server on PORT=${cfg.port} (uiPort=${cfg.uiPort}, mode=${last.mode}, lanHost=${last.lanHost || '-'})`
  )

  child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(cfg.port),
      UI_PORT: String(cfg.uiPort),
      NODE_ENV: process.env.NODE_ENV || 'development'
    },
    stdio: 'inherit',
    windowsHide: true
  })

  child.on('exit', (code, signal) => {
    console.log(`[launcher] Server exited code=${code} signal=${signal}`)
    child = null
  })
}

function stopChild() {
  if (!child) return

  console.log('[launcher] Stopping server...')

  try {
    child.kill('SIGTERM')
  } catch {}

  const pid = child.pid
  setTimeout(() => {
    if (!child) return

    console.log('[launcher] Forcing kill...')
    try {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })
    } catch {
      try {
        child.kill()
      } catch {}
    }
  }, 1200)
}

function restartChild() {
  stopChild()
  setTimeout(() => startChild(), 400)
}

let debounce = null
fs.watchFile(configPath, { interval: 300 }, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    const cfg = readConfig()
    const mode = cfg.mode || 'all'
    const lanHost = cfg.lanHost || ''

    if (cfg.port !== last.port || mode !== last.mode || lanHost !== last.lanHost) {
      console.log('[launcher] Restart due to config change: port/mode/lanHost')
      restartChild()
    }
  }, 200)
})

function shutdownLauncher(reason) {
  console.log(`[launcher] ${reason}`)
  stopChild()
  process.exit(0)
}

process.on('SIGINT', () => shutdownLauncher('SIGINT'))
process.on('SIGTERM', () => shutdownLauncher('SIGTERM'))

startChild()
