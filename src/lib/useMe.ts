'use client';

// Quem está usando o sistema (perfil do login). Uma busca só por tela
// carregada; o menu, os avisos e o "Resumo do dia" leem daqui.
import { useEffect, useState } from 'react';
import type { Role } from '@/lib/authToken';

export type Me = { role: Role; label: string; home: string };

let cached: Promise<Me | null> | null = null;

export function loadMe(): Promise<Me | null> {
  cached ??= fetch('/api/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.success ? (d.data as Me) : null))
    .catch(() => null);
  return cached;
}

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    loadMe().then((m) => alive && setMe(m));
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

/** Sai do sistema e volta para a tela de entrar. */
export async function logout() {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  cached = null;
  window.location.href = '/senha';
}
