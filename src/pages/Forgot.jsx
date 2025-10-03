import React, { useState } from 'react';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email) { setError('enter_email_first'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });
      const raw = await r.text();
      let j = {}; try { j = JSON.parse(raw); } catch {}
      if (!r.ok) throw new Error(j.error || raw || `http_${r.status}`);
      setInfo(`If this email exists, a reset link has been sent to ${email}.`);
    } catch (e2) {
      setError(String(e2.message || 'request_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="rounded-2xl border p-6">
        <h2 className="mb-4 text-2xl font-bold">Forgot password</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Enter your e-mail"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />
          <button disabled={busy} className="w-full rounded-xl border p-3" type="submit">
            {busy ? 'Sending link…' : 'Send reset link'}
          </button>
          {info && <p className="text-sm">{info}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="text-xs opacity-70">
            Remembered? <a href="#/login" className="underline">Back to Sign in</a>
          </div>
        </form>
      </div>
    </div>
  );
}
