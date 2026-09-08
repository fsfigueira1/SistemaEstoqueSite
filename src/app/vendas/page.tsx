import Link from 'next/link'

export default function VendasPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m2 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Laçolaria - Gestão de Vendas</h1>
                <p className="mt-1 text-sm text-gray-500">Visualize e gerencie todas as vendas realizadas</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">📊 Módulo de Vendas</h2>
              <p className="text-gray-600">Este módulo está em desenvolvimento. Em breve você poderá visualizar:</p>
              <ul className="mt-4 space-y-2 pl-5 list-disc text-gray-600">
                <li>Relatórios detalhados de vendas por período</li>
                <li>Análise de performance de produtos e categorias</li>
                <li>Gestão de clientes e histórico de compras</li>
              </ul>
            </div>
            <div className="mt-6">
              <Link href="/pdv" className="inline-flex items-center px-4 py-2 bg-gray-800 text-white font-medium rounded-sm hover:bg-gray-700">
                Voltar ao PDV
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}