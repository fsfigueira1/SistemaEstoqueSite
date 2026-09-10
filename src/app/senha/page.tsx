'use client';

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

      // The cookie is set in the response by the API route.
      // O papel VIEWER (deploy público de consulta) vai direto pra PWA.
      // Senão: caminho relativo same-origin do ?redirect= (evita open redirect).
      const url = new URL(window.location.href)
      const raw = url.searchParams.get('redirect') || '/'
      const safe = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
      window.location.href = data.role === 'VIEWER' ? '/m' : safe
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/logo.png"
              alt="Laçolaria"
              className="h-20 w-20 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-black/5"
            />
            <h2 className="font-heading text-2xl font-bold text-foreground">Laçolaria</h2>
          </div>
          <p className="text-center text-muted-foreground">
            Digite o PIN para acessar o sistema
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/90 mb-2">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
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
              <p className="text-sm text-danger">{error}</p>
            )}
          </form>
          <p className="text-xs text-muted-foreground text-center">
            Versão 1.0.0
          </p>
        </div>
      </div>
    </>
  )
}