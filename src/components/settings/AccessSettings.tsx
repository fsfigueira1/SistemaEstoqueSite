'use client';

// Configurações → Acesso (só o dono): usuário e senha do dono e do balcão.
// O que cada perfil abre está em src/lib/access.ts. Para mudar, confirma a
// senha atual do dono. Senha guardada só em hash.

import { useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Field, Section } from '@/components/settings/PriceSearchSettings';
import { errorText } from '@/lib/friendlyError';

type Profile = { role: 'OWNER' | 'EMPLOYEE'; user: string; custom: boolean };

const INFO: Record<Profile['role'], { title: string; can: string }> = {
  OWNER: { title: 'Dono', can: 'Vê tudo: painel em tempo real, relatórios, cadastro e configurações.' },
  EMPLOYEE: { title: 'Balcão', can: 'Só PDV, Vendas e Atendimento — sem faturamento, relatórios ou configurações.' },
};

const inp = 'w-full rounded-lg border border-border bg-card px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40';

function ProfileForm({ p, onSaved }: { p: Profile; onSaved: (list: Profile[]) => void }) {
  const [user, setUser] = useState(p.user);
  const [password, setPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = user.trim() !== p.user || password.length > 0;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/auth/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: p.role, user: user.trim() !== p.user ? user : undefined, password: password || undefined, ownerPassword }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(errorText(d, 'Não consegui salvar'));
      setPassword('');
      setOwnerPassword('');
      setMsg({ ok: true, text: 'Salvo. Vale no próximo login.' });
      onSaved(d.data);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, 'Não consegui salvar') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="font-medium text-foreground">{INFO[p.role].title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{INFO[p.role].can}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Usuário">
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" className={inp} maxLength={60} />
        </Field>
        <Field label="Senha nova">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="deixe vazio para manter" className={inp} />
        </Field>
      </div>
      {changed && (
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Sua senha de dono (para confirmar)">
            <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} autoComplete="current-password" className={inp} />
          </Field>
          <button
            type="button"
            onClick={save}
            disabled={busy || !ownerPassword}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-primary' : 'text-danger'}`}>{msg.text}</p>}
      {!p.custom && <p className="mt-2 text-xs text-muted-foreground">Ainda com a senha padrão de instalação — troque quando puder.</p>}
    </div>
  );
}

export default function AccessSettings() {
  const [list, setList] = useState<Profile[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/credentials')
      .then((r) => r.json())
      .then((d) => (d.success ? setList(d.data) : setErr(errorText(d, 'Não consegui carregar'))))
      .catch(() => setErr('Sem conexão'));
  }, []);

  return (
    <Section icon={<KeyRound className="h-5 w-5" />} title="Acesso" desc="Usuário e senha de cada perfil (o botão Sair fica no fim do menu)">
      {err && <p className="text-sm text-danger">{err}</p>}
      {!list && !err && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {list && (
        <div className="space-y-3">
          {list.map((p) => (
            <ProfileForm key={`${p.role}-${p.user}`} p={p} onSaved={setList} />
          ))}
        </div>
      )}
    </Section>
  );
}
