import { useEffect, useState } from 'react'
import Dashboard from '@/components/ui/Dashboard'
import { apiGet } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function Cabinet() {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const j = await apiGet('/api/me')
        if (!active) return
        setMe(j)
      } catch (e) {
        setErr(e.message || 'unauthorized')
      } finally {
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  function logout() {
    try { localStorage.removeItem('jwt') } catch {}
    window.location.href = '/#/'
  }

  if (loading) return <div className="max-w-3xl mx-auto p-6">Загрузка…</div>
  if (err) return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="text-lg font-semibold">Нужно войти</div>
      <div className="text-sm opacity-70">{err}</div>
      <Button onClick={()=>window.location.href='/#/login'}>Перейти к входу</Button>
    </div>
  )

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between">
        <div className="text-sm opacity-70">Вы вошли как <span className="font-medium">{me?.email || '…'}</span></div>
        <Button variant="secondary" onClick={logout}>Выйти</Button>
      </div>
      <Dashboard />
    </div>
  )
}
