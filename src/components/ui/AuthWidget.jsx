import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AuthWidget({ onAuth }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSignPass, setShowSignPass] = useState(false);
  const [showUpPass1, setShowUpPass1] = useState(false);
  const [showUpPass2, setShowUpPass2] = useState(false);
  const nav = useNavigate();

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
      let j = {}; try { j = JSON.parse(raw); } catch {}
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
        setInfo('Account is not verified. Check your inbox or sign up again to resend verification.');
      }
    }
  }

  async function submitSignup(e) {
  e.preventDefault();
  if (pass !== pass2) { setError('password_mismatch'); return; }
  if (pass.length < 8) { setError('weak_password'); return; }

  await post('/api/auth/register', { email, password: pass });

  // ✅ очистим введённые данные и покажем сообщение
  setEmail('');
  setPass('');
  setPass2('');
  setTab('signin');
  setInfo(`We sent a verification link to ${email}. Please confirm your account.`);
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
            <Link className="text-sm underline" to="/forgot">Forgot password?</Link>
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
    </div>
  );
}
