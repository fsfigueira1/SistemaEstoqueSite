import Link from 'next/link'

export default function ConfiguracoesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-pink-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Laçolaria - Configurações</h1>
                <p className="mt-1 text-sm text-gray-500">Ajuste as preferências e configurações do sistema</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">⚙️ Módulo de Configurações</h2>
              <p className="text-gray-600">Este módulo está em desenvolvimento. Em breve você poderá configurar:</p>
              <ul className="mt-4 space-y-2 pl-5 list-disc text-gray-600">
                <li>Preferências da empresa e dados fiscais</li>
                <li>Configurações de impressão e recibos</li>
                <li>Integração com meios de pagamento</li>
                <li>Gestão de usuários e permissões</li>
                <li>Backup e restauração de dados</li>
              </ul>
            </div>
            <div className="mt-6">
              <Link href="/dashboard" className="inline-flex items-center px-4 py-2 bg-gray-800 text-white font-medium rounded-sm hover:bg-gray-700">
                Voltar ao Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}