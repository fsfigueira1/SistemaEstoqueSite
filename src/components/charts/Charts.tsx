'use client';

// Gráficos do sistema (painel e relatório do mês). Regras do guia de
// visualização: uma série = cor principal, sem legenda (o título diz o que é);
// barras finas com ponta arredondada; grade e eixos discretos; dica ao passar
// o mouse; categorias (formas de pagamento) nas cores --chart-1..3, sempre com
// rótulo e valor escritos (nunca só a cor).

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
/** Eixo: curto para caber numa linha ("3,2 mil", "800"); o título do gráfico diz que é R$. */
export const brlShort = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${Math.round(v)}`;

type Point = { label: string; value: number; hint?: string };

function TipBox({ active, payload, format }: { active?: boolean; payload?: Array<{ payload: Point }>; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="font-medium text-foreground">{p.hint ?? p.label}</p>
      <p className="tabular-nums text-muted-foreground">{format(p.value)}</p>
    </div>
  );
}

const axis = { stroke: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--app-font-mono)', tickLine: false, axisLine: false } as const;

/**
 * Barras verticais (ex.: faturamento por dia). Com `highlight`, as barras ficam
 * na cor neutra e só a destacada (índice ou 'last') fica verde-água — sem
 * grade nem eixo de valores, como no Painel koda.
 */
export function ColumnChart({
  data,
  format = brl,
  height = 220,
  highlight,
}: {
  data: Point[];
  format?: (v: number) => string;
  height?: number;
  highlight?: number | 'last';
}) {
  const hi = highlight === 'last' ? data.length - 1 : highlight;
  const bare = hi !== undefined;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={bare ? '18%' : 2}>
          {!bare && <CartesianGrid vertical={false} stroke="var(--chart-grid)" />}
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={bare ? 24 : 8} />
          {bare ? <YAxis hide /> : <YAxis {...axis} width={60} tickFormatter={brlShort} />}
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<TipBox format={format} />} />
          <Bar dataKey="value" fill="var(--primary)" radius={bare ? [6, 6, 6, 6] : [4, 4, 0, 0]} maxBarSize={bare ? 46 : 22} minPointSize={bare ? 3 : 0} isAnimationActive={false}>
            {bare && data.map((_, i) => <Cell key={i} fill={i === hi ? 'var(--primary)' : 'var(--chart-rest)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Área com linha (tendência, ex.: últimos 30 dias). */
export function TrendChart({ data, format = brl, height = 200 }: { data: Point[]; format?: (v: number) => string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis} width={60} tickFormatter={brlShort} />
          <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} content={<TipBox format={format} />} />
          <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="url(#trendFill)" isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais em HTML (ranking): nome e valor sempre escritos. */
export function RankBars({
  items,
  format = brl,
  tone = 'primary',
  empty = 'Nada no período.',
}: {
  items: Array<{ label: string; value: number; extra?: string }>;
  format?: (v: number) => string;
  tone?: 'primary' | 'danger';
  empty?: string;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const lead = tone === 'danger' ? 'bg-danger/70' : 'bg-primary';
  const rest = tone === 'danger' ? 'bg-danger/40' : 'bg-foreground/85';
  return (
    <ol className="space-y-3.5">
      {items.map((i, n) => (
        <li key={`${i.label}-${n}`} className="flex items-start gap-4" title={`${i.label}: ${format(i.value)}${i.extra ? ` · ${i.extra}` : ''}`}>
          <span className="w-6 shrink-0 pt-1 font-mono text-xs tabular-nums text-muted-foreground">{String(n + 1).padStart(2, '0')}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate pt-0.5 font-medium text-foreground">{i.label}</span>
              <span className="shrink-0 text-right leading-tight">
                <span className="block font-heading font-semibold tabular-nums text-foreground">{format(i.value)}</span>
                {i.extra && <span className="block font-mono text-[11px] text-muted-foreground">{i.extra}</span>}
              </span>
            </div>
            <div className="mt-1 h-[3px] rounded-full bg-muted">
              <div className={`h-[3px] rounded-full ${n === 0 ? lead : rest}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Uma barra dividida em partes (ex.: formas de pagamento), com legenda e valores. */
export function ShareBar({ parts, format = brl }: { parts: Array<{ label: string; value: number; color: string }>; format?: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return <p className="py-4 text-center text-sm text-muted-foreground">Sem vendas no período.</p>;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-12 gap-1 overflow-hidden" role="img" aria-label={shown.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        {shown.map((p) => (
          <div key={p.label} className="rounded-xl" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${format(p.value)}`} />
        ))}
      </div>
      <ul className="mt-5 space-y-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5 text-[15px]">
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="font-medium text-foreground">{p.label}</span>
            <span className="ml-auto font-heading font-semibold tabular-nums text-foreground">{format(p.value)}</span>
            <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Variação em pílula (▲ 12%) — verde subindo, vermelho caindo. */
export function Delta({ value }: { value?: number | null }) {
  if (value == null || !Number.isFinite(value)) return null;
  return (
    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium ${value >= 0 ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger'}`}>
      {value >= 0 ? '▲' : '▼'} {Math.abs(Math.round(value))}%
    </span>
  );
}

/** Cartão de número grande, com variação opcional (ex.: vs mês anterior). */
export function StatTile({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-[1.7rem] font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Delta value={delta} />
        {sub}
      </p>
    </div>
  );
}

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEK_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** 5 tons da cor principal, do vazio ao dia mais forte (sequencial: uma cor, claro → escuro). */
const HEAT = ['var(--muted)', 'color-mix(in oklch, var(--primary) 25%, var(--card))', 'color-mix(in oklch, var(--primary) 50%, var(--card))', 'color-mix(in oklch, var(--primary) 75%, var(--card))', 'var(--primary)'];

/**
 * Mapa de calor das últimas semanas: uma coluna por semana, uma linha por dia
 * da semana; quanto mais escuro, mais vendeu. Valor de cada dia ao passar o
 * mouse e na leitura de tela.
 */
export function HeatCalendar({ days, format = brl }: { days: Array<{ date: string; revenue: number; count: number }>; format?: (v: number) => string }) {
  if (!days.length) return null;
  const max = Math.max(...days.map((d) => d.revenue), 0);
  const level = (v: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const dow = (k: string) => new Date(`${k}T12:00:00`).getDay();
  // começa no domingo da primeira semana; células antes do 1º dia ficam vazias
  const cells: Array<{ date: string; revenue: number; count: number } | null> = [...Array(dow(days[0].date)).fill(null), ...days];
  const weeks: Array<typeof cells> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const label = (k: string) => `${k.slice(8)}/${k.slice(5, 7)}`;
  return (
    <div>
      <div className="flex gap-1.5">
        <div className="grid grid-rows-7 gap-1.5 pr-1 font-mono text-[10px] leading-none text-muted-foreground">
          {WEEK.map((w, i) => (
            <span key={i} className="flex h-6 items-center">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((w, wi) => (
          <div key={wi} className="grid flex-1 grid-rows-7 gap-1.5">
            {Array.from({ length: 7 }, (_, di) => {
              const d = w[di];
              if (!d) return <span key={di} className="h-6" />;
              const tip = `${WEEK_FULL[dow(d.date)]} ${label(d.date)}: ${format(d.revenue)} (${d.count} venda${d.count === 1 ? '' : 's'})`;
              return <span key={di} className="h-6 rounded-md" style={{ background: HEAT[level(d.revenue)] }} title={tip} aria-label={tip} role="img" />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[11px] text-muted-foreground">
        menos
        {HEAT.map((c, i) => (
          <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: c }} aria-hidden />
        ))}
        mais
      </div>
    </div>
  );
}
