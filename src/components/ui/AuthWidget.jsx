async function signIn(e) {
  e.preventDefault();
  setError('');
  try {
    const res = await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // читаем как текст, а потом пытаемся распарсить JSON
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }

    if (!res.ok) {
      // покажем реальную причину (из JSON или из текста HTML ошибки)
      throw new Error(data?.error || text || 'request_failed');
    }

    setSent(true);
  } catch (e) {
    setError(String(e.message || e));
  }
}
