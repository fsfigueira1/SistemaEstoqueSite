// Logotipo "koda": letras redondas e grossas; o "o" é um círculo cheio.
// Desenhado em SVG (sem imagem) para ficar nítido em qualquer tamanho e
// funcionar offline. As letras usam a cor do texto (currentColor); o círculo
// usa `dot` — verde-água por padrão, ou a mesma cor das letras no fundo verde.

type Props = {
  className?: string;
  /** cor do círculo do "o" (padrão: verde-água do tema) */
  dot?: string;
  title?: string;
};

export default function KodaLogo({ className = 'h-6 w-auto', dot = 'var(--primary)', title = 'koda' }: Props) {
  return (
    <svg viewBox="0 0 748 256" className={className} role="img" aria-label={title} fill="currentColor">
      {/* k */}
      <rect x="0" y="0" width="54" height="256" rx="22" />
      <path d="M70 150 L122 106 M70 162 L134 228" stroke="currentColor" strokeWidth="54" strokeLinecap="round" fill="none" />
      {/* o */}
      <circle cx="264" cy="156" r="100" fill={dot} />
      {/* d */}
      <circle cx="447" cy="170" r="59" stroke="currentColor" strokeWidth="54" fill="none" />
      <rect x="480" y="0" width="54" height="256" rx="22" />
      {/* a */}
      <circle cx="627" cy="170" r="59" stroke="currentColor" strokeWidth="54" fill="none" />
      <rect x="694" y="80" width="54" height="176" rx="22" />
    </svg>
  );
}

/** Selo redondo com o "k" — avatar da assistente e ícones pequenos. */
export function KodaMark({ className = 'h-9 w-9 text-lg' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-heading font-extrabold leading-none text-primary-foreground ${className}`}
      aria-hidden
    >
      k
    </span>
  );
}
