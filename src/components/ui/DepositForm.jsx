
import { useState } from 'react'

export default function DepositForm({ onSubmit, loading }) {
  const [amount, setAmount] = useState('')

  return (
    <form onSubmit={(e)=>{e.preventDefault(); if(amount) onSubmit(parseFloat(amount))}} className="space-y-3">
      <div>
        <label className="block text-sm mb-1">Сумма депозита (USA₮)</label>
        <input type="number" min="1" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
      </div>
      <button disabled={loading} className="rounded-xl px-3 py-2 border w-full">{loading ? 'Обработка…' : 'Пополнить'}</button>
    </form>
  )
}
