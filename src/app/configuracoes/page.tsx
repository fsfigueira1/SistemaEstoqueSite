'use client';

export default function ConfiguracoesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Laçolaria - Configurações</h1>
          <p className="text-sm text-gray-600">Ajuste as preferências e configurações do sistema</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="text-center py-12">
            <div className="h-16 w-16 mx-auto mb-4 text-gray-400">
              ⚙️
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Módulo de Configurações</h2>
            <p className="text-gray-600">
              Este módulo está em desenvolvimento. Em breve você poderá configurar:
            </p>
            <div className="mt-6 space-y-3 text-left">
              <p className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span>Preferências da empresa e dados fiscais</span>
              </p>
              <p className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span>Configurações de impressão e recibos</span>
              </p>
              <p className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span>Integração com meios de pagamento</span>
              </p>
              <p className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span>Gestão de usuários e permissões</span>
              </p>
              <p className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 1118 0z" />
                </svg>
                <span>Backup e restauração de dados</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}