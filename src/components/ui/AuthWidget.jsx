
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthWidget({ onAuth }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onAuth(session.user, session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [onAuth])

  async function signIn(e){
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="max-w-md mx-auto p-6 rounded-2xl border">
      <h2 className="text-xl font-semibold mb-4">Вход / Регистрация</h2>
      {sent ? (
        <p className="text-sm">Мы отправили magic-link на <b>{email}</b>. Проверь почту и вернись по ссылке.</p>
      ) : (
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full border rounded-xl px-3 py-2"
            value={email}
            onChange={e=>setEmail(e.target.value)}
          />
          <button className="w-full rounded-xl px-3 py-2 border">Получить вход по e‑mail</button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      )}
      <p className="text-xs mt-4 opacity-70">Почта проекта: <a href="mailto:info@usatether.io" className="underline">info@usatether.io</a></p>
    </div>
  )
}
