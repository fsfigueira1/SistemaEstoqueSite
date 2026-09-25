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
  // perfil da loja e IA de preços
  storeProfile: string;
  storeCity: string;
  aiModel: string;
  priceAlertPercent: number;
  // fonte da pesquisa de preço: Google Shopping (grátis) ou Claude (pago)
  priceProvider: 'shopping' | 'claude';
  priceMarkupPercent: number;
  // taxas da maquininha e do Pix (%)
  feeDebitPercent: number;
  feeCreditPercent: number;
  feeCreditInstallmentPercent: number;
  feePixPercent: number;
  // backup automático
  backupEnabled: boolean;
  backupKeep: number;
  // assistente do relatório do dia
  reportReminderEnabled: boolean;
  reportReminderTime: string;
  cashFloatDefault: number;
  // somente leitura (a chave nunca vem do servidor)
  aiKeySet?: boolean;
  aiKeyHint?: string;
  shoppingKeySet?: boolean;
  shoppingKeyHint?: string;
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
  storeProfile:
    'Papelaria nova, bem localizada, com curadoria e toque gourmet: produtos selecionados, atendimento caprichado e embalagem bonita. O cliente aceita pagar um pouco acima da média, desde que o preço seja justificável.',
  storeCity: '',
  aiModel: 'claude-sonnet-5',
  priceAlertPercent: 10,
  priceProvider: 'shopping',
  priceMarkupPercent: 10,
  feeDebitPercent: 0,
  feeCreditPercent: 0,
  feeCreditInstallmentPercent: 0,
  feePixPercent: 0,
  backupEnabled: true,
  backupKeep: 30,
  reportReminderEnabled: true,
  reportReminderTime: '18:00',
  cashFloatDefault: 0,
  aiKeySet: false,
  aiKeyHint: '',
  shoppingKeySet: false,
  shoppingKeyHint: '',
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

/**
 * Grava no banco e no cache. `extra` vai só para o servidor (ex.: a chave da
 * IA, que nunca é guardada no navegador).
 */
export async function saveSettings(
  patch: Partial<StoreSettings>,
  extra?: { aiApiKey?: string; aiApiKeyClear?: boolean; shoppingApiKey?: string; shoppingApiKeyClear?: boolean },
): Promise<StoreSettings> {
  const next = { ...readCache(), ...patch };
  writeCache(next);
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...next, ...extra }),
    });
    const data = await res.json().catch(() => null);
    if (data?.success && data.data) {
      const merged = { ...DEFAULT_SETTINGS, ...data.data } as StoreSettings;
      writeCache(merged);
      return merged;
    }
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
