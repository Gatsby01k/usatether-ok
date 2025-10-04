// src/components/ui/AuthWidget.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, ShieldCheck,
  ArrowRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function cx(...a) { return a.filter(Boolean).join(' '); }

async function postJSON(path, body, setError, setBusy) {
  setBusy?.(true); setError?.('');
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const raw = await r.text();
    let j = {}; try { j = JSON.parse(raw); } catch {}
    if (!r.ok) throw new Error(j.error || raw || `http_${r.status}`);
    return j;
  } catch (e) {
    setError?.(String(e.message || 'request_failed'));
    throw e;
  } finally {
    setBusy?.(false);
  }
}

export default function AuthWidget({ onAuth }) {
  // показываем ТОЛЬКО одну форму
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'

  // поля
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [pass2, setPass2] = useState('');

  // UI
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [info,  setInfo]  = useState('');

  // show/hide
  const [showSignPass, setShowSignPass] = useState(false);
  const [showUpPass1,  setShowUpPass1]  = useState(false);
  const [showUpPass2,  setShowUpPass2]  = useState(false);

  useEffect(() => { setError(''); setInfo(''); }, [tab]);

  // --- actions ---
  async function onSignin(e) {
    e.preventDefault();
    try {
      const j = await postJSON('/api/auth/login', { email, password: pass }, setError, setBusy);
      if (j.token) localStorage.setItem('jwt', j.token);
      if (typeof onAuth === 'function') onAuth(j.user, j.token);
      const dash = `${window.location.origin}/#/dashboard`;
      window.location.replace(dash);
      setTimeout(() => window.location.reload(), 0);
    } catch (err) {
      if (String(err.message).includes('email_not_verified')) {
        setInfo('Account is not verified. Check your inbox or sign up again to resend verification.');
      }
    }
  }

  async function onSignup(e) {
    e.preventDefault();
    if (pass !== pass2) { setError('password_mismatch'); return; }
    if (pass.length < 8) { setError('weak_password'); return; }

    await postJSON('/api/auth/register', { email, password: pass }, setError, setBusy);

    // очистим поля и вернём на вход
    const to = email;
    setEmail(''); setPass(''); setPass2('');
    setTab('signin');
    setInfo(`We sent a verification link to ${to}. Please confirm your account.`);
  }

  return (
    <div className="relative">
      {/* фирменная полоска сверху */}
      <div className="absolute inset-x-0 -top-4 h-1.5 bg-gradient-to-r from-red-500 via-white to-blue-600 rounded-full" />

      <Card className="overflow-hidden shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-red-600 via-white to-blue-700 ring-2 ring-offset-2" />
            <div>
              <CardTitle className="text-xl">USATether Account</CardTitle>
              <CardDescription className="text-muted-foreground">
                Secure access with email & password
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* СЕГМЕНТ-ПЕРЕКЛЮЧАТЕЛЬ с «пилюлей»-индикатором */}
          <div className="relative mb-4 rounded-xl border p-1">
            <div
              className={cx(
                'pointer-events-none absolute top-1 bottom-1 left-1 w-1/2 rounded-lg',
                'shadow-sm transition-transform duration-200',
                'bg-gradient-to-r from-red-500/25 via-red-400/25 to-blue-600/25',
                tab === 'signin' ? 'translate-x-0' : 'translate-x-full'
              )}
            />
            <div className="relative z-10 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setTab('signin')}
                aria-selected={tab === 'signin'}
                className={cx(
                  'rounded-lg py-2 text-sm transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
                  tab === 'signin' ? 'font-semibold text-foreground' : 'text-foreground/60 hover:text-foreground'
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setTab('signup')}
                aria-selected={tab === 'signup'}
                className={cx(
                  'rounded-lg py-2 text-sm transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
                  tab === 'signup' ? 'font-semibold text-foreground' : 'text-foreground/60 hover:text-foreground'
                )}
              >
                Sign up
              </button>
            </div>
          </div>

          {/* баннеры */}
          {!!info && (
            <div className="mt-3 mb-4 flex items-start gap-2 rounded-xl border p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
              <div>{info}</div>
            </div>
          )}
          {!!error && (
            <div className="mt-3 mb-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <div>{error}</div>
            </div>
          )}

          {/* ---------- SIGN IN ---------- */}
          {tab === 'signin' && (
            <form onSubmit={onSignin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-in">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                  <Input
                    id="email-in"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass-in">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                  <Input
                    id="pass-in"
                    type={showSignPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="pl-9 pr-12"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showSignPass ? 'Hide password' : 'Show password'}
                    aria-pressed={showSignPass}
                    onClick={() => setShowSignPass(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  >
                    {showSignPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="submit"
                  disabled={busy}
                  className={cx(
                    'group',
                    'bg-gradient-to-r from-red-600 via-red-500 to-blue-600 text-white',
                    'hover:from-red-500 hover:via-red-400 hover:to-blue-500'
                  )}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>

                <Link to="/forgot" className="text-sm underline text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          {/* ---------- SIGN UP ---------- */}
          {tab === 'signup' && (
            <form onSubmit={onSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-up">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                  <Input
                    id="email-up"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass-up">Password (min 8)</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                  <Input
                    id="pass-up"
                    type={showUpPass1 ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="pl-9 pr-12"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showUpPass1 ? 'Hide password' : 'Show password'}
                    aria-pressed={showUpPass1}
                    onClick={() => setShowUpPass1(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  >
                    {showUpPass1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pass2-up">Repeat password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                  <Input
                    id="pass2-up"
                    type={showUpPass2 ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                    className="pl-9 pr-12"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showUpPass2 ? 'Hide password' : 'Show password'}
                    aria-pressed={showUpPass2}
                    onClick={() => setShowUpPass2(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  >
                    {showUpPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="submit"
                  disabled={busy}
                  className={cx(
                    'group',
                    'bg-gradient-to-r from-red-600 via-red-500 to-blue-600 text-white',
                    'hover:from-red-500 hover:via-red-400 hover:to-blue-500'
                  )}
                >
                  {busy ? 'Sending…' : 'Create account'}
                  <ShieldCheck className="ml-2 h-4 w-4" />
                </Button>

                <span className="text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button onClick={() => setTab('signin')} type="button" className="underline">
                    Sign in
                  </button>
                </span>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* лёгкое бренд-свечение сзади */}
      <div className="pointer-events-none absolute -inset-4 -z-10 blur-2xl opacity-60" aria-hidden>
        <div className="h-full w-full bg-[radial-gradient(70%_50%_at_70%_0%,rgba(239,68,68,0.12),transparent),radial-gradient(70%_50%_at_0%_100%,rgba(59,130,246,0.10),transparent)]"></div>
      </div>
    </div>
  );
}
