// Trava de segurança: os testes de banco APAGAM tabelas inteiras (vendas,
// produtos, caixa...). Eles só podem rodar contra um banco de teste local —
// nunca contra o Supabase da loja. Se DATABASE_URL apontar para outro lugar,
// tudo para aqui, antes de qualquer teste tocar no banco.
const SAFE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertTestDatabase(url = process.env.DATABASE_URL): void {
  if (!url) return; // sem banco: só os testes puros rodam; os de banco falham sozinhos
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = '';
  }
  if (SAFE_HOSTS.has(host) || /(^|[.-])test([.-]|$)/.test(host)) return;
  throw new Error(
    `BLOQUEADO: DATABASE_URL aponta para "${host || 'endereço inválido'}", que não é um banco de teste. ` +
      'Os testes apagam tabelas inteiras — use um Postgres local (localhost) para rodá-los.',
  );
}
