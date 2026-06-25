// Thin fetch wrapper around the FastAPI backend, with JWT bearer auth.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000'
const TOKEN_KEY = 'agentaios_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function req(method: string, path: string, body?: unknown): Promise<any> {
  const headers: Record<string, string> = {}
  const tok = getToken()
  if (tok) headers.Authorization = `Bearer ${tok}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    setToken(null)
    // mid-session expiry: tell the app to drop back to the login screen
    if (!path.startsWith('/auth/')) {
      try { window.dispatchEvent(new Event('agentaios:unauthorized')) } catch { /* noop */ }
    }
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (j?.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get: (p: string) => req('GET', p),
  post: (p: string, b?: unknown) => req('POST', p, b ?? {}),
  patch: (p: string, b?: unknown) => req('PATCH', p, b ?? {}),
  del: (p: string) => req('DELETE', p),
  base: BASE,
}
