'use client';

import { useState, useEffect } from 'react'

export default function PinLock({ children }: { children: React.ReactNode }) {
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

  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar">
        <img src="/logo.png" alt="Laçolaria" className="h-20 w-20 animate-pulse rounded-3xl bg-white object-cover" />
      </div>
    )
  }

  if (!isUnlocked) {
    const isFirstTime = storedPin === null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar p-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <img
              src="/logo.png"
              alt="Laçolaria"
              className="h-20 w-20 rounded-3xl bg-white object-cover shadow-sm ring-1 ring-black/5"
            />
            <div>
              <p className="font-heading text-2xl font-semibold text-foreground">Laçolaria</p>
              <p className="eyebrow mt-1">Papelaria fina</p>
            </div>
            <div className="rule-accent w-full" />
            <h2 className="text-lg text-foreground">{isFirstTime ? 'Defina seu PIN' : 'Digite seu PIN'}</h2>
          </div>
          <form onSubmit={isFirstTime ? handleChangePin : handleSubmit} className="space-y-4">
            <div>
              <label className="sr-only">
                {isFirstTime ? 'Novo PIN' : 'PIN'}
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-center text-2xl tracking-[0.4em] focus:border-ring focus:ring-2 focus:ring-ring/40"
                autoFocus
                inputMode="numeric"
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
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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