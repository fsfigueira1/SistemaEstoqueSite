'use client';

// Configurações locais da loja (this device). O app é de gestão em uma
// máquina só, então persistimos no localStorage. Usado no comprovante do PDV.

export type StoreSettings = {
  companyName: string;
  companyTagline: string;
  companyDoc: string; // CNPJ/CPF
  companyAddress: string;
  companyPhone: string;
  receiptFooter: string;
  receiptShowCompany: boolean;
  receiptWidth: '58mm' | '80mm';
};

const KEY = 'lacolaria_settings';

export const DEFAULT_SETTINGS: StoreSettings = {
  companyName: 'LAÇOLARIA',
  companyTagline: 'Papelaria e Presentes',
  companyDoc: '',
  companyAddress: '',
  companyPhone: '',
  receiptFooter: 'Obrigado pela preferencia! Troca em ate 7 dias com este comprovante.',
  receiptShowCompany: true,
  receiptWidth: '80mm',
};

export function getSettings(): StoreSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Partial<StoreSettings>): StoreSettings {
  const merged = { ...getSettings(), ...s };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged;
}

// PIN local do PinLock
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
