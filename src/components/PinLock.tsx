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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="p-4 bg-white rounded-lg shadow-xl">
          <h2 className="text-xl font-bold text-center mb-4">Iniciando...</h2>
          <p className="text-sm text-gray-600 text-center">
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
        <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold text-center mb-6">
            {isFirstTime ? 'Defina seu PIN' : 'Digite seu PIN'}
          </h2>
          <form onSubmit={isFirstTime ? handleChangePin : handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isFirstTime ? 'Novo PIN' : 'PIN'}
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Digite o PIN"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg letter-spacing-wide"
                maxLength={6}
                autoComplete="off"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isFirstTime ? 'Definir PIN' : 'Desbloquear'}
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-500 text-center">
            Seu PIN é armazenado localmente neste dispositivo.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}