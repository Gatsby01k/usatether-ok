import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiGet, apiPost } from '@/lib/api'

// Форматирование чисел
function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '0.00'
  return Number(n).toFixed(2)
}

export default function Dashboard() {
  const [balance, setBalance] = useState(null)      // { total_usat, principal_usat, accrued_usat }
  const [deposits, setDeposits] = useState([])      // [{id, amount_usat, created_at}]
  const [withdrawals, setWithdrawals] = useState([])// [{id, amount_usat, created_at}]
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const timerRef = useRef(null)

  const loadAll = useCallback(async () => {
    try {
      setErr('')
      const [b, d, w] = await Promise.all([
        apiGet('/api/balance'),
        apiGet('/api/deposits'),
        apiGet('/api/withdrawals').catch(() => ({ items: [] })), // если ручки нет — не падаем
      ])
      setBalance(b)
      setDeposits(d.items || [])
      setWithdrawals(w.items || [])
      setLastUpdated(new Date())
    } catch (e) {
      setErr(e.message || 'load_failed')
    }
  }, [])

  useEffect(() => {
    loadAll()

    // авто-обновление каждые 10с, но пауза, если вкладка скрыта
    const tick = () => { if (!document.hidden) loadAll() }
    timerRef.current && clearInterval(timerRef.current)
    timerRef.current = setInterval(tick, 10_000)

    const onVis = () => { if (!document.hidden) loadAll() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      timerRef.current && clearInterval(timerRef.current)
    }
  }, [loadAll])

  async function doDeposit(e) {
    e.preventDefault()
    if (busy) return
    const val = Number(amount)
    if (!Number.isFinite(val) || val <= 0) { setErr('Введите сумму > 0'); return }
    try {
      setBusy(true); setErr('')
      await apiPost('/api/deposits', { amount_usat: val })
      setAmount('')
      await loadAll()
    } catch (e) {
      setErr(e.message || 'deposit_error')
    } finally {
      setBusy(false)
    }
  }

  async function doWithdraw(e) {
    e.preventDefault()
    if (busy) return
    const val = Number(amount)
    if (!Number.isFinite(val) || val <= 0) { setErr('Введите сумму > 0'); return }
    try {
      setBusy(true); setErr('')
      await apiPost('/api/withdrawals', { amount_usat: val })
      setAmount('')
      await loadAll()
    } catch (e) {
      setErr(e.message || 'withdraw_error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-baseline justify-between">
          <CardTitle className="text-lg">Баланс</CardTitle>
          <div className="text-xs opacity-70">
            {lastUpdated ? `обновлено: ${lastUpdated.toLocaleTimeString()}` : ''}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {!balance ? (
            <div className="text-sm opacity-70">Загрузка…</div>
          ) : (
            <>
              <div className="text-3xl font-bold">
                {fmt(balance.total_usat)} <span className="text-base font-medium">USA₮</span>
              </div>
              <div className="text-sm opacity-70">
                Внесено: {fmt(balance.principal_usat)} • Начислено: {fmt(balance.accrued_usat)}
              </div>
              <p className="text-sm opacity-70 mt-1">Доходность: 25% в месяц, сложное начисление каждые 5 секунд.</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">Операции</CardTitle></CardHeader>
        <CardContent className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm opacity-70">Сумма, USA₮</label>
            <Input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="100" />
          </div>
          <Button onClick={doDeposit} disabled={busy}>Пополнить</Button>
          <Button onClick={doWithdraw} disabled={busy} variant="secondary">Вывести</Button>
        </CardContent>
        {err && <div className="px-6 pb-4 text-sm text-red-500">{err}</div>}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Депозиты</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(deposits || []).map(it => (
                <li key={it.id} className="flex justify-between text-sm">
                  <span>{new Date(it.created_at).toLocaleString()}</span>
                  <span className="font-medium">{fmt(it.amount_usat)} USA₮</span>
                </li>
              ))}
              {(!deposits || deposits.length === 0) && <li className="text-sm opacity-70">Пока нет пополнений</li>}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Выводы</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(withdrawals || []).map(it => (
                <li key={it.id} className="flex justify-between text-sm">
                  <span>{new Date(it.created_at).toLocaleString()}</span>
                  <span className="font-medium">−{fmt(it.amount_usat)} USA₮</span>
                </li>
              ))}
              {(!withdrawals || withdrawals.length === 0) && <li className="text-sm opacity-70">Ещё не выводили</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
