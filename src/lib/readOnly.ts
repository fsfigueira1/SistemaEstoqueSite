// Trava de escrita para o deploy público (Vercel). Ligada por READ_ONLY=1.
// O app de computador (Electron) roda sem a env, então nada muda pra ele.

type Decision = { allow: true } | { allow: false; status: number };

type Input = {
  method: string;
  pathname: string;
  headers: Record<string, string | null | undefined>;
  env: { READ_ONLY?: string; CRON_SECRET?: string };
};

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function readOnlyDecision({ method, pathname, headers, env }: Input): Decision {
  if (env.READ_ONLY !== '1') return { allow: true };
  if (SAFE.has(method.toUpperCase())) return { allow: true };

  // Única exceção mutante: o cron da Vercel, autenticado pelo secret.
  if (pathname.startsWith('/api/cron/')) {
    const auth = headers.authorization ?? headers.Authorization ?? '';
    if (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`) return { allow: true };
  }

  return { allow: false, status: 403 };
}
