import { useEffect, useState } from 'react';

export default function AuthWidget({ onAuth }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(''); // тексты типа "мы отправили письмо"

  useEffect(() => { setError(''); setInfo(''); }, [tab]);

  async function post(path, body) {
    setBusy(true); setError('');
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const raw = await r.text();
      let j = {};
      try { j = JSON.parse(raw); } catch {}
      if (!r.ok) throw new Error(j.error || raw || `http_${r.status}`);
      return j;
    } catch (e) {
      setError(String(e.message || 'request_failed'));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function submitSignin(e) {
    e.preventDefault();
    try {
      const j = await post('/api/auth/login', { email, password: pass });
      if (j.token) localStorage.setItem('jwt', j.token);
      if (typeof onAuth === 'function') onAuth(j.user, j.token);
      const dash = `${window.location.origin}/#/dashboard`;
      window.location.replace(dash);
      setTimeout(() => window.location.reload(), 0);
    } catch (e) {
      if (String(e.message).includes('email_not_verified')) {
        setInfo('Account is not verified. We can resend the verification email.');
      }
    }
  }

  async function submitSignup(e) {
    e.preventDefault();
    if (pass !== pass2) { setError('password_mismatch'); return; }
    if (pass.length < 8) { setError('weak_password'); return; }
    await post('/api/auth/register', { email, password: pass });
    setTab('signin');
    setInfo(`We sent a verification link to ${email}. Please confirm your account.`);
  }

  async function resend() {
    try {
      await post('/api/auth/resend-verification', { email });
      setInfo(`Verification email was resent to ${email}.`);
    } catch {}
  }

  return (
    <div className="rounded-2xl border p-6">
      <h2 className="mb-4 text-2xl font-bold">Вход / Регистрация</h2>

      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border">
        <button
          className={`p-2 text-sm ${tab==='signin' ? 'bg-foreground text-background' : ''}`}
          onClick={() => setTab('signin')}
        >Sign in</button>
        <button
          className={`p-2 text-sm ${tab==='signup' ? 'bg-foreground text-background' : ''}`}
          onClick={() => setTab('signup')}
        >Sign up</button>
      </div>

      {info && (
        <div className="mb-3 rounded-xl border p-3 text-sm">
          {info} {info.includes('not verified') && (
            <button className="underline ml-2" onClick={resend} disabled={busy}>Resend</button>
          )}
        </div>
      )}

      {tab === 'signin' ? (
        <form onSubmit={submitSignin} className="space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="you@example.com"
            type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
          />
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Password"
            type="password" value={pass} onChange={(e)=>setPass(e.target.value)} required
          />
          <button disabled={busy} className="w-full rounded-xl border p-3" type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      ) : (
        <form onSubmit={submitSignup} className="space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="you@example.com"
            type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
          />
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Password (min 8)"
            type="password" value={pass} onChange={(e)=>setPass(e.target.value)} required
          />
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Repeat password"
            type="password" value={pass2} onChange={(e)=>setPass2(e.target.value)} required
          />
          <button disabled={busy} className="w-full rounded-xl border p-3" type="submit">
            {busy ? 'Sending verification…' : 'Create account'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      )}

      <p className="text-xs mt-4 opacity-70">
        Почта проекта:{' '}
        <a href="mailto:info@usatether.io" className="underline">info@usatether.io</a>
      </p>
    </div>
  );
}
