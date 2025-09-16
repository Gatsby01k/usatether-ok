
import { useEffect, useState, useCallback, useRef } from 'react'

export default function Dashboard({ token }){
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const timerRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [b, h] = await Promise.all([
        fetch('/api/balance', { headers: { Authorization: 'Bearer ' + token }}).then(r=>r.json()),
        fetch('/api/deposits', { headers: { Authorization: 'Bearer ' + token }}).then(r=>r.json())
      ])
      setBalance(b)
      setHistory(h)
      setLastUpdated(new Date())
      setLoading(false)
    } catch (e){
      // noop, could add toast
    }
  }, [token])

  useEffect(()=>{
    setLoading(true)
    fetchData()

    // auto-refresh every 10 seconds
    timerRef.value && clearInterval(timerRef.value)
    timerRef.value = setInterval(fetchData, 10000)

    return () => {
      timerRef.value && clearInterval(timerRef.value)
    }
  }, [fetchData])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border p-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold mb-2">Баланс</h3>
          <div className="text-xs opacity-70">
            {lastUpdated ? `обновлено: ${lastUpdated.toLocaleTimeString()}` : ''}
          </div>
        </div>
        {loading ? 'Загрузка…' : (
          <div className="text-3xl font-bold">{(balance?.total_usat ?? 0).toFixed(2)} <span className="text-base font-medium">USA₮</span></div>
        )}
        <p className="text-sm opacity-70 mt-1">Доходность: 25% в месяц, сложное начисление каждые 5 секунд.</p>
      </div>

      <div className="rounded-2xl border p-6">
        <h3 className="text-lg font-semibold mb-4">Депозиты</h3>
        <ul className="space-y-2">
          {history.map(it => (
            <li key={it.id} className="flex justify-between text-sm">
              <span>{new Date(it.created_at).toLocaleString()}</span>
              <span className="font-medium">{Number(it.amount_usat).toFixed(2)} USA₮</span>
            </li>
          ))}
          {history.length === 0 && <li className="text-sm opacity-70">Пока нет пополнений</li>}
        </ul>
      </div>
    </div>
  )
}
