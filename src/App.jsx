import AuthWidget from '@/components/ui/AuthWidget.jsx';
import Cabinet from './pages/Cabinet.jsx'
import React, { useEffect, useMemo, useState } from "react";
import { HashRouter as Router, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShieldCheck, Wallet, CreditCard, ChevronRight, LogIn, LogOut, LineChart, Coins, BadgeDollarSign, Lock, ArrowRight, Banknote, Percent, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ============================================================
// USATether – React SPA (без Supabase)
// Auth: magic-link через /api/auth/request и /api/auth/verify
// JWT хранится в localStorage под ключом "jwt"
// ============================================================

// ---------- Utilities ----------
const brand = {
  name: "USATether",
  ticker: "USA₮",
  slogan: "A stable way to move your money*",
  apr: 25, // monthly (demo)
};

const currencies = [
  { code: "BTC", name: "Bitcoin" },
  { code: "ETH", name: "Ethereum" },
  { code: "USDT", name: "Tether" },
  { code: "USDC", name: "USD Coin" },
  { code: "SOL", name: "Solana" },
  { code: "TRX", name: "TRON" },
];

const demoPriceSeries = Array.from({ length: 24 }).map((_, i) => ({
  m: `M${i + 1}`,
  v: 1000 * Math.pow(1 + 0.25, i / 12),
}));

const gradientBg =
  "bg-[radial-gradient(80%_60%_at_70%_10%,rgba(255,0,0,0.15),transparent),radial-gradient(80%_60%_at_30%_90%,rgba(0,0,255,0.12),transparent)]";

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function authHeader() {
  const t = localStorage.getItem('jwt');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ---------- Theme ----------
function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem("usat:dark") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("usat:dark", dark ? "1" : "0");
  }, [dark]);
  return { dark, setDark };
}

// ---------- Auth (JWT + /api/me) ----------
const AuthContext = React.createContext(null);
function useAuthContext() { return React.useContext(AuthContext); }

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1) Если пришли по magic-link (?token=...), подтвердить и сохранить jwt
useEffect(() => {
  function getTokenFromUrl() {
    const sp = new URLSearchParams(window.location.search);
    const t1 = sp.get('token');
    if (t1) return t1;
    const h = window.location.hash || '';
    const i = h.indexOf('?');
    if (i !== -1) {
      const qs = h.slice(i + 1);
      const t2 = new URLSearchParams(qs).get('token');
      if (t2) return t2;
    }
    return null;
  }
  function stripTokenFromHash() {
    const baseHash = (window.location.hash || '').split('?')[0] || '#/';
    window.history.replaceState({}, '', window.location.pathname + baseHash);
  }

  (async () => {
    const token = getTokenFromUrl();
    if (!token) return;
    try {
      const r = await fetch(`/api/auth/verify?token=${token}`);
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.token) {
        localStorage.setItem('jwt', data.token);
        stripTokenFromHash();
        // ВАЖНО: редиректим ВСЕГДА, даже если пришли на #/login
        window.location.hash = '#/dashboard';
      }
      // если не ок — ничего не делаем: виджет на /login покажет ошибку
    } catch {
      // ignore
    }
  })();
}, []);


  // 2) Подтянуть профиль по JWT
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/me', { headers: { 'Content-Type': 'application/json', ...authHeader() } });
        if (r.ok) {
          const me = await r.json();
          setUser(me);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestLoginLink = async (email) => {
    const r = await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!r.ok) {
      const j = await r.json().catch(()=>({}));
      throw new Error(j.error || 'request_failed');
    }
    return true;
  };

  const logout = () => {
    localStorage.removeItem('jwt');
    setUser(null);
  };

  return { user, loading, requestLoginLink, logout };
}

function Protected({ children }) {
  const { user, loading } = useAuthContext();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ---------- Layout ----------
function Ribbon() {
  return (
    <div className="relative isolate overflow-hidden">
      <div className={clsx("absolute inset-0 -z-10 opacity-80", gradientBg)} />
      <div className="absolute inset-x-0 top-0 -z-10 h-2 bg-gradient-to-r from-red-500 via-white to-blue-600" />
    </div>
  );
}

function Nav() {
  const { user, logout } = useAuthContext();
  const { dark, setDark } = useTheme();
  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-600 via-white to-blue-700 ring-2 ring-offset-2 ring-offset-background" />
          <span className="text-xl font-black tracking-tight">USATether</span>
          <span className="ml-2 rounded-md border px-1.5 py-0.5 text-xs font-semibold">USA₮</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/#invest" className="hidden md:block">
            <Button size="sm" variant="ghost" className="group">Invest <ChevronRight className="ml-1 h-4 w-4 transition -translate-x-0 group-hover:translate-x-0.5"/></Button>
          </Link>
          <Link to="/pricing" className="hidden md:block"><Button size="sm" variant="ghost">Pricing</Button></Link>
          <Link to="/docs" className="hidden md:block"><Button size="sm" variant="ghost">Docs</Button></Link>
          <Button size="icon" variant="ghost" aria-label="Toggle theme" onClick={() => setDark(!dark)}>
            {dark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
          </Button>
          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/dashboard"><Button size="sm" className="gap-2"><Wallet className="h-4 w-4"/> Dashboard</Button></Link>
              <Button size="icon" variant="ghost" onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4"/></Button>
            </div>
          ) : (
            <Link to="/login"><Button size="sm" className="gap-2"><LogIn className="h-4 w-4"/> Sign in</Button></Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-red-600 via-white to-blue-700" />
            <span className="font-semibold">USATether</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">A stable way to move your money* Not available in all jurisdictions.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Company</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li><Link to="/about">About</Link></li>
            <li><Link to="/careers">Careers</Link></li>
            <li><Link to="/compliance">Compliance</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Legal</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li><Link to="/tos">Terms</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/risk">Risk Disclosure</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} USATether. *Demo UI only. Returns are illustrative and not guaranteed.
      </div>
    </footer>
  );
}

// ---------- Pages ----------
function Home() {
  return (
    <main>
      <Ribbon />
      <Hero />
      <TrustBar />
      <Features />
      <Invest id="invest" />
      <CTA />
    </main>
  );
}

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative mx-auto mt-8 max-w-6xl px-4">
      <div className="grid items-center gap-8 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Stable by Design. <span className="bg-gradient-to-r from-red-600 via-white to-blue-700 bg-clip-text text-transparent">Powered by USA₮</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-prose">
            Invest and purchase USA₮ using your favorite crypto. Target monthly return: <span className="font-semibold">25%</span> (demo).
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="group" size="lg" onClick={() => navigate("/#invest")}>Start investing <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5"/></Button>
            <Link to="/docs"><Button variant="outline" size="lg" className="gap-2"><ShieldCheck className="h-4 w-4"/> Learn more</Button></Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">This interface is for demonstration only. Always DYOR.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5"/> Growth Simulator</CardTitle>
              <CardDescription>Assumes 25% monthly compounding (demo)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={demoPriceSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                        <stop offset="75%" stopColor="#3b82f6" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="m" hide />
                    <YAxis hide />
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                    <Area type="monotone" dataKey="v" stroke="#ef4444" fill="url(#usaGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <div className="mx-auto mt-10 max-w-6xl px-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["Non-custodial", "Audited", "Multi-chain", "Instant"]
          .map((t) => (
            <div key={t} className="rounded-xl border p-4 text-center text-sm text-muted-foreground">{t}</div>
          ))}
      </div>
    </div>
  );
}

function Features() {
  const items = [
    { icon: <Wallet className="h-5 w-5" />, title: "Invest easily", desc: "Fund with BTC, ETH, USDT, USDC, SOL, or TRX in seconds." },
    { icon: <ShieldCheck className="h-5 w-5" />, title: "Security-first", desc: "2FA, hardware wallet support, and anti-phishing checks." },
    { icon: <BadgeDollarSign className="h-5 w-5" />, title: `25% / mo target`, desc: "Automated yield strategy – demo figures for UI showcase." },
  ];
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((it) => (
          <Card key={it.title} className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">{it.icon} {it.title}</CardTitle>
              <CardDescription>{it.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-1 w-1/2 rounded-full bg-gradient-to-r from-red-500 to-blue-600 transition-all group-hover:w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Invest() {
  const [amount, setAmount] = useState(1000);
  const [asset, setAsset] = useState("USDT");
  const [months, setMonths] = useState(6);
  const nav = useNavigate();
  const projection = useMemo(() => amount * Math.pow(1 + 25 / 100, months), [amount, months]);
  return (
    <section id="invest" className="mx-auto mt-16 max-w-6xl px-4">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold">Invest in USA₮</h2>
        <Link to="/docs" className="text-sm text-muted-foreground hover:underline">How it works</Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5"/> Fund your position</CardTitle>
            <CardDescription>Choose a crypto and amount to convert into USA₮.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="asset">Funding asset</Label>
                <select id="asset" className="mt-2 w-full rounded-xl border bg-background p-2" value={asset} onChange={(e) => setAsset(e.target.value)}>
                  {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code} – {c.name}</option>))}
                </select>
              </div>
              <div>
                <Label htmlFor="amt">Amount (USD)</Label>
                <Input id="amt" type="number" min={10} step={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="months">Term (months)</Label>
                <input id="months" type="range" min={1} max={24} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="mt-3 w-full" />
                <div className="mt-1 text-sm text-muted-foreground">{months} month(s)</div>
              </div>
              <div className="rounded-xl bg-muted p-3 text-sm">
                <div className="flex items-center justify-between"><span>Projected value</span><span className="font-semibold">${projection.toFixed(2)}</span></div>
                <div className="mt-1 text-xs text-muted-foreground">Assumes 25% monthly compounding. Demo only.</div>
              </div>
              <div className="flex gap-3">
                <Button className="gap-2"><CreditCard className="h-4 w-4"/> Buy USA₮</Button>
                <Button variant="outline" className="gap-2" onClick={() => nav("/login")}>Create account <ChevronRight className="h-4 w-4"/></Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5"/> Yield overview</CardTitle>
            <CardDescription>Visualize the hypothetical growth of your deposit.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={Array.from({ length: months + 1 }).map((_, i) => ({ m: i, v: amount * Math.pow(1 + 25 / 100, i) }))}>
                  <defs>
                    <linearGradient id="fillArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="m" tickFormatter={(v) => `${v}m`} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v)}`} />
                  <Tooltip formatter={(val) => `$${Number(val).toFixed(2)}`} labelFormatter={(l) => `${l} month(s)`} />
                  <Area dataKey="v" type="monotone" stroke="#ef4444" fill="url(#fillArea)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function CTA() {
  const nav = useNavigate();
  return (
    <section className="mx-auto my-24 max-w-6xl px-4">
      <Card className="relative overflow-hidden">
        <div className={clsx("absolute inset-0 -z-10 opacity-70", gradientBg)} />
        <CardHeader className="md:flex md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl">Ready to try USATether?</CardTitle>
            <CardDescription>Open your account in minutes and fund with your preferred crypto.</CardDescription>
          </div>
          <div className="mt-4 md:mt-0">
            <Button size="lg" className="gap-2" onClick={() => nav("/signup")}><Lock className="h-4 w-4"/> Create account</Button>
          </div>
        </CardHeader>
      </Card>
    </section>
  );
}

// ---------- Auth Pages (magic-link) ----------
function Login() {
  const { user, loading } = useAuthContext();

  // пока грузим профиль — ничего не рендерим
  if (loading) return null;

  // если уже авторизован — сразу уводим в кабинет
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // иначе показываем форму логина
  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <AuthWidget
        onAuth={() => {
          // после успешной верификации магик-линка
          window.location.hash = '#/dashboard';
        }}
      />
    </div>
  );
}

function Signup() {
  // регистрация = тот же логин по magic-link, юзер создастся при verify
  return <Login />;
}

// ---------- Dashboard ----------
function Dashboard() {
  const { user, logout } = useAuthContext();
  const [bal, setBal] = useState(2500);
  const [buyAmt, setBuyAmt] = useState(200);
  const [sel, setSel] = useState("USDT");

  useEffect(() => {
    const id = setInterval(() => setBal((b) => Number((b * 1.0005).toFixed(2))), 2000);
    return () => clearInterval(id);
  }, []);

  const tx = useMemo(() => [
    { t: "Deposit", a: 1000, c: "USDT" },
    { t: "Deposit", a: 0.02, c: "BTC" },
    { t: "Yield", a: 35.4, c: "USA₮" },
  ], []);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Welcome, {user?.email}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={logout}><LogOut className="h-4 w-4"/> Sign out</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5"/> Portfolio Balance</CardTitle>
            <CardDescription>Live demo updates (not real funds)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-4xl font-black tracking-tight">${bal.toLocaleString()}</div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={Array.from({ length: 30 }).map((_, i) => ({ d: i, v: 2500 * Math.pow(1 + 0.25 / 30, i) }))}>
                  <defs>
                    <linearGradient id="dash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" hide/>
                  <YAxis hide/>
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`}/>
                  <Area dataKey="v" type="monotone" stroke="#ef4444" fill="url(#dash)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5"/> Quick Buy</CardTitle>
            <CardDescription>Convert crypto to USA₮.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label htmlFor="sel">Asset</Label>
              <select id="sel" className="mt-2 w-full rounded-xl border bg-background p-2" value={sel} onChange={(e) => setSel(e.target.value)}>
                {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code} – {c.name}</option>))}
              </select>
            </div>
            <div>
              <Label htmlFor="buy">Amount (USD)</Label>
              <Input id="buy" type="number" min={10} step={10} value={buyAmt} onChange={(e) => setBuyAmt(Number(e.target.value))} className="mt-2"/>
            </div>
            <Button className="gap-2">Buy USA₮ <ChevronRight className="h-4 w-4"/></Button>
            <p className="text-xs text-muted-foreground">This is a static UI. Connect real APIs to enable transfers.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {tx.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div>
                      <div className="font-medium">{r.t}</div>
                      <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{r.a} {r.c}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deposit / Withdraw</CardTitle>
            <CardDescription>Manage your funds.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="gap-2"><Wallet className="h-4 w-4"/> Deposit</Button>
            <Button variant="outline" className="gap-2"><Wallet className="h-4 w-4"/> Withdraw</Button>
            <p className="text-xs text-muted-foreground">This is a static UI. Connect real APIs to enable transfers.</p>
          </CardContent>
        </Card>
      </div>

      <LegalNote />
    </div>
  );
}

function LegalNote() {
  return (
    <div className="mt-10 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
      <p>
        <strong>Important:</strong> This site is a <em>design & demo prototype</em>. The advertised 25% monthly return is for demonstration only and not a promise of future performance. Cryptocurrency involves risk. Not investment advice. Ensure regulatory compliance and obtain necessary licenses before launching.
      </p>
    </div>
  );
}

// ---------- Static Docs ----------
function Docs() {
  return (
    <div className="mx-auto mt-12 max-w-3xl px-4">
      <h1 className="text-3xl font-bold">Documentation</h1>
      <p className="mt-4 text-muted-foreground">This SPA is static and suitable for premium shared hosting (e.g., Netlify, Vercel, GitHub Pages). To enable live investments and real auth, integrate APIs/wallets (e.g., WalletConnect, Coinbase Onramp) and a backend later if required.</p>
      <ul className="mt-6 list-inside list-disc space-y-2 text-sm">
        <li>Client routing via <code>HashRouter</code> (no server rewrites needed).</li>
        <li>Auth via email magic-link and JWT.</li>
        <li>UI components: shadcn/ui, lucide-react, Tailwind, Framer Motion, Recharts.</li>
        <li>Accessible, responsive layout with dark mode.</li>
      </ul>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-3xl px-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">Try going back to the <Link to="/" className="underline">home page</Link>.</p>
    </div>
  );
}

// ---------- App Shell ----------
export default function App() {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-dvh bg-background text-foreground">
        <Router>
          <Nav />
          <Routes>
            <Route path="/cabinet" element={<Cabinet />} />
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </Router>
      </div>
    </AuthContext.Provider>
  );
}
