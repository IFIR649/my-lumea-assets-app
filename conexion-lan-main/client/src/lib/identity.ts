const KEY_ID = 'lan_share_client_id'
const KEY_NAME = 'lan_share_client_name'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getClientId(): string {
  let id = localStorage.getItem(KEY_ID)
  if (!id) {
    id = generateId()
    localStorage.setItem(KEY_ID, id)
  }
  return id
}

export function getClientName(): string {
  return localStorage.getItem(KEY_NAME) || ''
}

export function setClientName(name: string) {
  localStorage.setItem(KEY_NAME, name.trim())
}

export function clearClientName() {
  localStorage.removeItem(KEY_NAME)
}
