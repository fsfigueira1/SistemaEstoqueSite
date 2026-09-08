'use client';

import Head from 'next/head'
import { useState } from 'react'

export default function SenhaPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'PIN incorreto')
      }

      // The cookie is set in the response by the API route
      // Redirect to the dashboard or the previous page
      const url = new URL(window.location.href)
      const redirect = url.searchParams.get('redirect') || '/'
      window.location.href = redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>PIN de Acesso - Laçolaria ERP</title>
        <meta name="description" content="Digite o PIN para acessar o sistema" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-6 p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-center text-gray-900">
            Acesso ao Sistema
          </h2>
          <p className="text-center text-gray-600">
            Digite o PIN para acessar o ERP Laçolaria
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 me-2 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </form>
          <p className="text-xs text-gray-500 text-center">
            Versão 1.0.0
          </p>
        </div>
      </div>
    </>
  )
}