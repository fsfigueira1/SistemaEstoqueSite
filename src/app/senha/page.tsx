'use client';

// Entrar: usuário e senha. Dono vê tudo; balcão abre PDV, Vendas e
// Atendimento. Depois de entrar vai para a tela que pediu (se o perfil puder)
// ou para a tela inicial do perfil.

import { useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { errorText } from '@/lib/friendlyError';

export default function SenhaPage() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(errorText(data, 'Usuário ou senha incorretos'));
      // só caminho do próprio sistema (nada de ir para outro site); se o perfil
      // não puder abrir a tela pedida, o servidor manda para a tela inicial dele
      const raw = new URL(window.location.href).searchParams.get('redirect') || '';
      const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : data.data.home;
      window.location.href = target;
    } catch (err) {
      setError(errorText(err, 'Não consegui entrar'));
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const inp =
    'w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/40';

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <main className="w-full max-w-sm">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <img src="/logo.png" alt="" className="h-20 w-20 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-black/5" />
            <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">Laçolaria</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entre com seu usuário e senha</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Usuário</span>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                className={inp}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Senha</span>
              <span className="relative block">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className={`${inp} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !user.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-sidebar-muted">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </main>
    </div>
  );
}
