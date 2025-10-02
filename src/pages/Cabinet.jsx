import { useEffect, useState } from 'react';

// Мини-обёртки для запросов с JWT из localStorage
function authHeader() {
  const t = localStorage.getItem('jwt') || '';
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function apiGet(path) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json', ...authHeader() } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

export default function Cabinet() {
  const [me, setMe] = useState(null);
  const [balance, setBalance] = useState(0);
  const [deps, setDeps] = useState([]);
  const [wds, setWds] = useState([]);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');

  async function loadAll() {
    setErr('');
    try {
      const [m, b, d, w] = await Promise.all([
        apiGet('/api/me'),
        apiGet('/api/balance'),
        apiGet('/api/deposits'),
        apiGet('/api/withdrawals'),
      ]);
      setMe(m);
      setBalance(b.balance_usat || 0);
      setDeps(d);
      setWds(w);
    } catch (e) {
      setErr(e.message || 'error');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function makeDeposit(e) {
    e.preventDefault();
    setErr('');
    try {
      if (!amount) return;
      await apiPost('/api/deposits', { amount_usat: Number(amount) });
      setAmount('');
      await loadAll();
    } catch (e) {
      setErr(e.message || 'deposit_error');
    }
  }

  async function makeWithdraw(e) {
    e.preventDefault();
    setErr('');
    try {
      if (!amount) return;
      await apiPost('/api/withdrawals', { amount_usat: Number(amount) });
      setAmount('');
      await loadAll();
    } catch (e) {
      setErr(e.message || 'withdraw_error');
    }
  }

  // Если юзер не залогинен (нет JWT или /api/me вернул 401) — показываем заглушку
  if (!localStorage.getItem('jwt')) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">Требуется вход</h1>
        <p>Войдите по email (получите ссылку) и повторите.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Кабинет</h1>

      {err && <div className="text-red-600">Ошибка: {String(err)}</div>}

      <div className="p-4 border rounded-xl">
        <div className="mb-2">Пользователь: <b>{me?.email || '—'}</b></div>
        <div>Баланс: <b>{balance}</b> USAT</div>
      </div>

      <form className="p-4 border rounded-xl space-y-3" onSubmit={makeDeposit}>
        <label className="block text-sm">Сумма (USAT)</label>
        <input
          className="border rounded-xl px-3 py-2 w-full"
          type="number"
          min="0"
          step="0.000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
        />
        <div className="flex gap-3">
          <button className="border rounded-xl px-4 py-2" type="submit">Пополнить</button>
          <button className="border rounded-xl px-4 py-2" type="button" onClick={makeWithdraw}>Вывести</button>
        </div>
      </form>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 border rounded-xl">
          <h2 className="font-semibold mb-2">Депозиты</h2>
          <ul className="space-y-1">
            {deps.map((r) => (
              <li key={r.id} className="text-sm flex justify-between">
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <span>{r.amount_usat} USAT</span>
              </li>
            ))}
            {!deps.length && <li className="text-sm text-gray-500">Пусто</li>}
          </ul>
        </div>

        <div className="p-4 border rounded-xl">
          <h2 className="font-semibold mb-2">Выводы</h2>
          <ul className="space-y-1">
            {wds.map((r) => (
              <li key={r.id} className="text-sm flex justify-between">
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <span>-{r.amount_usat} USAT</span>
              </li>
            ))}
            {!wds.length && <li className="text-sm text-gray-500">Пусто</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
