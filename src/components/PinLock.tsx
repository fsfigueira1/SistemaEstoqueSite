'use client';

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function PinLock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // A PWA de consulta (/m) tem seu próprio PIN de leitura (/senha); não
  // sobrepõe o cadeado local do balcão.
  const skipLock = pathname?.startsWith('/m') ?? false
  const [ready, setReady] = useState(false)
  const [storedPin, setStoredPin] = useState<string | null>(null)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('app_pin')
    setStoredPin(stored)
    setReady(true)
    if (stored) {
      setIsUnlocked(false)
    } else {
      // No PIN set yet, set a default PIN (for first use)
      const defaultPin = '1234'
      localStorage.setItem('app_pin', defaultPin)
      setIsUnlocked(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === storedPin) {
      setIsUnlocked(true)
      setError('')
    } else {
      setError('PIN incorreto')
      setPin('')
    }
  }

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault()
    const newPin = pin.trim()
    if (newPin.length >= 4) {
      localStorage.setItem('app_pin', newPin)
      setIsUnlocked(true)
      setError('')
    } else {
      setError('O PIN deve ter pelo menos 4 dígitos')
    }
  }

  if (skipLock) {
    return <>{children}</>
  }

  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="p-4 bg-card rounded-lg shadow-xl">
          <h2 className="text-xl font-bold text-center mb-4">Iniciando...</h2>
          <p className="text-sm text-muted-foreground text-center">
            Verificando suas configurações...
          </p>
        </div>
      </div>
    )
  }

  if (!isUnlocked) {
    const isFirstTime = storedPin === null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-5 flex flex-col items-center gap-2">
            <img
              src="/logo.png"
              alt="Laçolaria"
              className="h-16 w-16 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-black/5"
            />
            <h2 className="font-heading text-xl font-bold">
              {isFirstTime ? 'Defina seu PIN' : 'Digite seu PIN'}
            </h2>
          </div>
          <form onSubmit={isFirstTime ? handleChangePin : handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/90 mb-2">
                {isFirstTime ? 'Novo PIN' : 'PIN'}
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Digite o PIN"
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring/40 focus:border-ring text-lg letter-spacing-wide"
                maxLength={6}
                autoComplete="off"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isFirstTime ? 'Definir PIN' : 'Desbloquear'}
            </button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Seu PIN é armazenado localmente neste dispositivo.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}