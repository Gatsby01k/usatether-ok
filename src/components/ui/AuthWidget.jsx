import { useState, useEffect } from 'react';

function getTokenFromUrl() {
  // 1) классический поиск до '#'
  const sp = new URLSearchParams(window.location.search);
  const t1 = sp.get('token');
  if (t1) return t1;

  // 2) если HashRouter: #/login?token=...
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex !== -1) {
    const qs = hash.slice(qIndex + 1);
    const t2 = new URLSearchParams(qs).get('token');
    if (t2) return t2;
  }
  return null;
}

function stripTokenFromHash() {
  const baseHash = (window.location.hash || '').split('?')[0] || '#/login';
  // Сохраняем route, но убираем query с токеном
  window.history.replaceState({}, '', window.location.pathname + baseHash);
}

export default function AuthWidget({ onAuth }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // --- Проверка токена из URL (после перехода по magic-link) ---
  useEffect(() => {
    async function checkVerify() {
      const token = getTokenFromUrl();
      if (!token) { setChecking(false); return; }
      try {
        const res = await fetch(`/api/auth/verify?token=${token}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.token) {
          localStorage.setItem('jwt', data.token);
          stripTokenFromHash();
          if (typeof onAuth === 'function') onAuth(data.user, data.token);
        } else {
          setError(data.error || 'verify_failed');
        }
      } catch {
        setError('verify_failed');
      } finally {
        setChecking(false);
      }
    }
    checkVerify();
  }, [onAuth]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'request_failed');
      setSent(true);
    } catch (err) {
      setError(err.message || 'request_failed');
    }
  }

  if (checking) return null;

  return (
    <div className="rounded-2xl border p-6">
      <h2 className="mb-4 text-2xl font-bold">Вход / Регистрация</h2>

      {sent ? (
        <p>
          Мы отправили magic-link на <b>{email}</b>. Проверь почту и перейди по ссылке, чтобы войти.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="w-full rounded-xl border p-3" type="submit">
            Получить вход по e-mail
          </button>
          {error && <p className="text-red-600 text-sm">{String(error)}</p>}
        </form>
      )}

      <p className="text-xs mt-4 opacity-70">
        Почта проекта:{' '}
        <a href="mailto:info@usatether.io" className="underline">
          info@usatether.io
        </a>
      </p>
    </div>
  );
}
