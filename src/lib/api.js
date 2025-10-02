// src/lib/api.js — без Supabase, с JWT из localStorage

function authHeader() {
  try {
    const t = localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export async function apiGet(path) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

export async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
