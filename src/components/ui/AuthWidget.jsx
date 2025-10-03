import { useEffect, useState } from 'react';

export default function AuthWidget({ onAuth, initialMode = 'auth', initialResetToken = '' }) {
  // режимы: 'auth' (signin/signup) | 'setpass' (по ссылке из письма)
  const [tab, setTab] = useState('signin');
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // видимость паролей
  const [showSignPass, setShowSignPass] = useState(false);
  const [showUpPass1, setShowUpPass1] = useState(false);
  const [showUpPass2, setShowUpPass2] = useState(false);
  const [showNew1, setShowNew1] = useState(false);
  const [showNew2, setShowNew2] = useState(false);

  // если Login передал параметры — фиксируем их
  useEffect(() => {
    if (initialMode === 'setpass') setMode('setpass');
    if (initialResetToken) setResetToken(initialResetToken);
  }, [initialMode, initialResetToken]);

  useEffect(() => { setError(''); setInfo(''); }, [tab, mode]);

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
        setInfo('Account is not verified. Check your inbox or resend from Sign up.');
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

  async function requestReset() {
    if (!email) { setError('enter_email_first'); return; }
    try {
      await post('/api/auth/reset-request', { email });
      setInfo(`If this email exists, a reset link has been sent to ${email}.`);
    } catch {}
  }

  async function submitSetNew(e) {
    e.preventDefault();
    if (!resetToken) { setError('invalid_or_expired'); return; }
    if (newPass !== newPass2) { setError('password_mismatch'); return; }
    if (newPass.length < 8) { setError('weak_password'); return; }
    const j = await post('/api/auth/reset-confirm', { token: resetToken, password: newPass });
    if (j.token) localStorage.setItem('jwt', j.token);
    if (typeof onAuth === 'function') onAuth(j.user, j.token);
    const dash = `${window.location.origin}/#/dashboard`;
    window.location.replace(dash);
    setTimeout(() => window.location.reload(), 0);
  }

  return (
    <div className="rounded-2xl border p-6">
      <h2 className="mb-4 text-2xl font-bold">
        {mode === 'setpass' ? 'Set a new password' : 'Вход / Регистрация'}
      </h2>

      {mode === 'auth' && (
        <>
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

          {info && <div className="mb-3 rounded-xl border p-3 text-sm">{info}</div>}

          {tab === 'signin' ? (
            <form onSubmit={submitSignin} className="space-y-3">
              <input
                className="w-full rounded-xl border p-3"
                placeholder="you@example.com"
                type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
              />
              <div className="relative">
                <input
                  className="w-full rounded-xl border p-3 pr-20"
                  placeholder="Password"
                  type={showSignPass ? 'text' : 'password'}
                  value={pass} onChange={(e)=>setPass(e.target.value)} required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
                  onClick={()=>setShowSignPass(v=>!v)}
                >
                  {showSignPass ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button disabled={busy} className="rounded-xl border px-4 py-2" type="submit">
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <button type="button" className="text-sm underline" onClick={requestReset}>
                  Forgot password?
                </button>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </form>
          ) : (
            <form onSubmit={submitSignup} className="space-y-3">
              <input
                className="w-full rounded-xl border p-3"
                placeholder="you@example.com"
                type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
              />
              <div className="relative">
                <input
                  className="w-full rounded-xl border p-3 pr-20"
                  placeholder="Password (min 8)"
                  type={showUpPass1 ? 'text' : 'password'}
                  value={pass} onChange={(e)=>setPass(e.target.value)} required
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
                        onClick={()=>setShowUpPass1(v=>!v)}>
                  {showUpPass1 ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <input
                  className="w-full rounded-xl border p-3 pr-20"
                  placeholder="Repeat password"
                  type={showUpPass2 ? 'text' : 'password'}
                  value={pass2} onChange={(e)=>setPass2(e.target.value)} required
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
                        onClick={()=>setShowUpPass2(v=>!v)}>
                  {showUpPass2 ? 'Hide' : 'Show'}
                </button>
              </div>
              <button disabled={busy} className="w-full rounded-xl border p-3" type="submit">
                {busy ? 'Sending verification…' : 'Create account'}
              </button>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </form>
          )}
        </>
      )}

      {mode === 'setpass' && (
        <>
          {info && <div className="mb-3 rounded-xl border p-3 text-sm">{info}</div>}
          <form onSubmit={submitSetNew} className="space-y-3">
            <div className="relative">
              <input
                className="w-full rounded-xl border p-3 pr-20"
                placeholder="New password (min 8)"
                type={showNew1 ? 'text' : 'password'}
                value={newPass} onChange={(e)=>setNewPass(e.target.value)} required
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
                      onClick={()=>setShowNew1(v=>!v)}>
                {showNew1 ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="relative">
              <input
                className="w-full rounded-xl border p-3 pr-20"
                placeholder="Repeat new password"
                type={showNew2 ? 'text' : 'password'}
                value={newPass2} onChange={(e)=>setNewPass2(e.target.value)} required
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm underline"
                      onClick={()=>setShowNew2(v=>!v)}>
                {showNew2 ? 'Hide' : 'Show'}
              </button>
            </div>
            <button disabled={busy} className="w-full rounded-xl border p-3" type="submit">
              {busy ? 'Saving…' : 'Set new password'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        </>
      )}

      <p className="text-xs mt-4 opacity-70">
        Почта проекта:{' '}
        <a href="mailto:info@usatether.io" className="underline">info@usatether.io</a>
      </p>
    </div>
  );
}
