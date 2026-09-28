'use client';

// Última rede de segurança: erro no layout raiz (menu, PIN, sincronização).
// Sem isto a janela do app ficaria com a tela padrão "Application error".
// Tem o próprio <html>/<body> e estilos inline (o CSS do app não carrega aqui).
export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  // eslint-disable-next-line quality/no-direct-console -- detalhe técnico só no console do app
  if (typeof console !== 'undefined') console.error(error);
  const again = () => {
    try {
      (retry ?? reset)?.();
    } catch {
      /* ignora */
    }
  };
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#faf7f5', color: '#2b2b2b' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 380, textAlign: 'center', background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Algo deu errado</h1>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 20px' }}>Nada foi perdido. Tente de novo; se continuar, reinicie o app.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={again} style={{ padding: '10px 16px', borderRadius: 8, border: 0, background: '#0aa', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
                Tentar de novo
              </button>
              <button onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 15, cursor: 'pointer' }}>
                Recarregar a tela
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
