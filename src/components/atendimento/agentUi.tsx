'use client';

// Peças visuais do Atendimento com IA (estilo "agente no controle"): avatar
// com iniciais, passos com ✓, balões da conversa e o fundo pontilhado.
// Usadas em AgentToday e WinbackBoard.

import { Check, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

const PASTEL = ['bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-teal-100 text-teal-700'];

export const initials = (name: string) =>
  name
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('pt-BR'))
    .join('') || '?';

const tone = (name: string) => PASTEL[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PASTEL.length];

export function Avatar({ name, online, size = 'md' }: { name: string; online?: boolean; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${box} ${tone(name)}`}>
      {initials(name)}
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" aria-hidden />}
    </span>
  );
}

export function StepChips({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {steps.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1 font-mono text-[11px] text-muted-foreground shadow-sm">
          <Check className="h-3 w-3 text-success" strokeWidth={3} />
          {s}
        </span>
      ))}
    </div>
  );
}

export const hhmm = (d: string | number | Date) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function Bubble({ from, text, at }: { from: 'cliente' | 'ia'; text: string; at?: string | Date | null }) {
  if (from === 'cliente')
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2 text-sm text-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words">{text}</p>
          {at && <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{hhmm(at)}</p>}
        </div>
      </div>
    );
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-md">
        <p className="whitespace-pre-wrap break-words">{text}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold opacity-80">
          <Sparkles className="h-3 w-3" /> IA {at ? `· ${hhmm(at)}` : ''}
        </p>
      </div>
    </div>
  );
}

/** Área da conversa com o fundo pontilhado das prints. */
export function ChatArea({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 bg-muted/40 px-4 py-4 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:14px_14px]">
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</section>;
}
