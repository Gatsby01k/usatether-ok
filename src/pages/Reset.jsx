import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Reset() {
  const q = useQuery();
  const [token, setToken] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  useEffect(() => {
    const t = q.get('token') || '';
    setToken(t);
  }, [q]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!token) { setError('invalid_or_expired'); return; }
    if (p1.length < 8) { setError('weak_password'); return; }
    if (p1 !== p2) { setError('password_mismatch'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: p1 }),
        credentials: 'include'
      });
      const raw = await r.text();
      let j = {}; try { j = JSON.parse(raw); } catch {}
      if (!r.ok) throw new Error(j.error || raw || `http_${r.status}`);
      if (j.token) localStorage.setItem('jwt', j.token);
      // сразу в кабинет + жёсткий reload
      const dash = `${window.location.origin}/#/dashboard`;
      window.location.replace(dash);
      setTimeout(() => window.location.reload(), 0);
    } catch (e2) {
      setError(String(e2.message || 'request_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="rounded-2xl border p-6">
        <h2 className="mb-4 text-2xl font-bold">Set a new password</h2>

        {!token && (
          <div className="rounded-xl border p-3 text-sm mb-3">
            Invalid or missing token. <a href="#/forgot" className="underline">Request a new link</a>.
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input
              className="w-full rounded-xl border p-3 pr-20"
              placeholder="New password (min 8)"
              type={show1 ? 'text' : 'password'}
              value={p1}
              onChange={(e)=>setP1(e.target.value)}
              required
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
              onClick={()=>setShow1(v=>!v)}>
              {show1 ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="relative">
            <input
              className="w-full rounded-xl border p-3 pr-20"
              placeholder="Repeat new password"
              type={show2 ? 'text' : 'password'}
              value={p2}
              onChange={(e)=>setP2(e.target.value)}
              required
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
              onClick={()=>setShow2(v=>!v)}>
              {show2 ? 'Hide' : 'Show'}
            </button>
          </div>
          <button disabled={busy || !token} className="w-full rounded-xl border p-3" type="submit">
            {busy ? 'Saving…' : 'Set new password'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="text-xs opacity-70">
            Back to <a href="#/login" className="underline">Sign in</a>
          </div>
        </form>
      </div>
    </div>
  );
}
