'use client';

// Cadastro de produto: mostra o lucro sobre o custo e compara com a meta da
// loja (Configurações → Pesquisa de preço → Meta de lucro).

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getSettings, loadSettings } from '@/lib/settings';
import { priceForTarget, profitPercent } from '@/lib/profit';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function ProfitHint({
  cost,
  price,
  onUsePrice,
}: {
  cost: number;
  price: number;
  onUsePrice: (p: number) => void;
}) {
  const [target, setTarget] = useState(() => getSettings().profitTargetPercent ?? 110);
  useEffect(() => {
    loadSettings()
      .then((s) => setTarget(s.profitTargetPercent ?? 110))
      .catch(() => {});
  }, []);

  const lucro = profitPercent(cost, price);
  if (lucro == null || !(price > 0)) return null;
  const ok = lucro >= target - 0.05;
  const min = priceForTarget(cost, target);
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
      }`}
    >
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <span>
        Lucro de <strong className="tabular-nums">{lucro.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong> sobre o custo
        {ok ? ` (meta ${target}%)` : ` — abaixo da meta de ${target}%`}
      </span>
      {!ok && min != null && (
        <button type="button" onClick={() => onUsePrice(min)} className="ml-auto text-xs font-medium underline">
          Usar {brl(min)}
        </button>
      )}
    </div>
  );
}
