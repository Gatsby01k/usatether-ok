import { supabase } from './supabase'

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export async function apiGet(path) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(await authHeader()) } })
  const j = await r.json().catch(()=> ({}))
  if (!r.ok) throw new Error(j.error || r.statusText)
  return j
}

export async function apiPost(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(body) })
  const j = await r.json().catch(()=> ({}))
  if (!r.ok) throw new Error(j.error || r.statusText)
  return j
}
