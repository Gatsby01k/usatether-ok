import { useEffect, useState } from 'react';

export default function AuthWidget({ onAuth }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setError(''); }, [tab]);

  async function call(path, body) {
  setBusy(true);
  setError('');
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',                      // важно: чтобы cookie jwt устанавливалась
    });

    const raw = await r.text();                    // читаем как текст (бывает пусто/не-JSON)
    let j = {};
    try { j = JSON.parse(raw); } catch {}

    if (!r.ok) {
      throw new Error(j.error || raw || `http_${r.status}`);
    }

    // совместимость: если API вернул token — положим в localStorage
    if (j.token) localStorage.setItem('jwt', j.token);
    if (typeof onAuth === 'function') onAuth(j.user, j.token);

    // 🔥 мгновенно в кабинет и тут же полный reload,
    // чтобы контекст useAuth подтянул профиль и кнопка стала "Dashboard"
    const dash = `${window.location.origin}/#/dashboard`;
    window.location.replace(dash);
    // следующая строка гарантирует, что контекст авторизации поднимется заново
    setTimeout(() => window.location.reload(), 0);
    return;
  } catch (e) {
    setError(String(e.message || 'request_failed'));
  } finally {
    setBusy(false);
  }
}


  function submitSignin(e) {
    e.preventDefault();
    call('/api/auth/login', { email, password: pass });
  }

  function submitSignup(e) {
    e.preventDefault();
    if (pass !== pass2) { setError('password_mismatch'); return; }
    if (pass.length < 8) { setError('weak_password'); return; }
    call('/api/auth/register', { email, password: pass });
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
            {busy ? 'Creating…' : 'Create account'}
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
