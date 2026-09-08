'use client';

// Configurações da loja. A fonte de verdade é o banco (tabela Settings),
// compartilhada entre as máquinas. Mantemos um cache no localStorage para o
// componente de comprovante poder ler de forma síncrona na hora de imprimir.

export type StoreSettings = {
  companyName: string;
  companyTagline: string;
  companyDoc: string;
  companyAddress: string;
  companyPhone: string;
  receiptFooter: string;
  receiptShowCompany: boolean;
  receiptWidth: '58mm' | '80mm';
  cardInterestPercent: number;
  cardInterestFromInstallments: number;
};

const CACHE_KEY = 'lacolaria_settings';

export const DEFAULT_SETTINGS: StoreSettings = {
  companyName: 'LAÇOLARIA',
  companyTagline: 'Papelaria e Presentes',
  companyDoc: '',
  companyAddress: '',
  companyPhone: '',
  receiptFooter: 'Obrigado pela preferencia! Troca em ate 7 dias com este comprovante.',
  receiptShowCompany: true,
  receiptWidth: '80mm',
  cardInterestPercent: 3.5,
  cardInterestFromInstallments: 2,
};

function readCache(): StoreSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeCache(s: StoreSettings) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Leitura síncrona do cache local (usada pelo comprovante). */
export function getSettings(): StoreSettings {
  return readCache();
}

/** Busca do banco e atualiza o cache. Chamar no mount das telas. */
export async function loadSettings(): Promise<StoreSettings> {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data?.success && data.data) {
      const merged = { ...DEFAULT_SETTINGS, ...data.data } as StoreSettings;
      writeCache(merged);
      return merged;
    }
  } catch {
    /* offline: usa o cache */
  }
  return readCache();
}

/** Grava no banco e no cache. */
export async function saveSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const next = { ...readCache(), ...patch };
  writeCache(next);
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  } catch {
    /* offline: mantém só no cache até reconectar */
  }
  return next;
}

// ---- PIN local do PinLock (permanece por dispositivo) ----
export function getLocalPin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('app_pin');
  } catch {
    return null;
  }
}
export function setLocalPin(pin: string) {
  try {
    window.localStorage.setItem('app_pin', pin);
  } catch {
    /* ignore */
  }
}
