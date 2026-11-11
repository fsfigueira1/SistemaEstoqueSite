'use client';

// Entrar: usuário e senha. Dono vê tudo; balcão abre PDV, Vendas e
// Atendimento. Depois de entrar vai para a tela que pediu (se o perfil puder)
// ou para a tela inicial do perfil.

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import KodaLogo from '@/components/KodaLogo';
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

  return (
    <div className="grid min-h-screen bg-ink text-cream lg:grid-cols-2">
      {/* metade verde: marca */}
      <section className="flex flex-col justify-between bg-primary p-8 text-ink sm:p-14">
        <KodaLogo className="h-7 w-auto self-start" dot="currentColor" />
        <div className="py-12">
          <KodaLogo className="h-24 w-auto max-w-full sm:h-36" dot="currentColor" />
          <p className="mt-8 max-w-md text-xl font-medium leading-snug sm:text-[1.6rem]">
            Sistema de gestão para o balcão e o estoque da sua loja.
          </p>
        </div>
        <div className="flex items-center justify-between font-mono text-sm">
          <span>@buildkoda</span>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        </div>
      </section>

      {/* metade escura: entrar */}
      <main className="koda-ink flex items-center justify-center bg-ink p-8 sm:p-14">
        <div className="w-full max-w-md">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            Laçolaria · Papelaria fina
          </p>
          <h1 className="mt-3 text-5xl text-foreground">Entrar</h1>
          <p className="mt-3 text-lg text-muted-foreground">Entre com seu usuário e senha</p>

          <form onSubmit={submit} className="mt-8 space-y-7" noValidate>
            <label className="block">
              <span className="block text-sm font-semibold text-foreground">Usuário</span>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                className="field-line"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-foreground">Senha</span>
              <span className="relative block">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="field-line pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex items-center font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  {show ? 'esconder' : 'mostrar'}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !user.trim() || !password}
              className="flex w-full items-center justify-between rounded-full bg-primary py-2 pl-8 pr-2 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Entrando…' : 'Entrar'}
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink text-primary">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
