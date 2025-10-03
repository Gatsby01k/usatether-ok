import { useState, useEffect } from 'react';

export default function AuthWidget({ onAuth }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // --- Проверка токена из URL (после перехода по magic-link) ---
  useEffect(() => {
    async function checkVerify() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        try {
          const res = await fetch(`/api/auth/verify?token=${token}`);
          const text = await res.text();
          let data = {};
          try { data = JSON.parse(text); } catch { /* ignore if not JSON */ }

          if (res.ok && data.token) {
            localStorage.setItem('jwt', data.token);
            if (onAuth) onAuth(data.user, data.token);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setError(data?.error || text || 'Ошибка входа');
          }
        } catch (e) {
          setError('Ошибка сервера');
        }
      }
      setChecking(false);
    }
    checkVerify();
  }, [onAuth]);

  // --- Отправка magic-link ---
  async function signIn(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { /* ignore non-JSON */ }

      if (!res.ok) {
        throw new Error(data?.error || text || 'request_failed');
      }

      setSent(true);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  if (checking) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl border">
        <p className="text-sm opacity-70">Проверка сессии...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 rounded-2xl border">
      <h2 className="text-xl font-semibold mb-4">Вход / Регистрация</h2>
      {sent ? (
        <p className="text-sm">
          Мы отправили magic-link на <b>{email}</b>. Проверь почту и перейди по ссылке, чтобы войти.
        </p>
      ) : (
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full border rounded-xl px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="w-full rounded-xl px-3 py-2 border">
            Получить вход по e-mail
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
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
