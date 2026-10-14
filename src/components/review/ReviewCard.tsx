import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

/** Moldura de cada seção da Revisão de cadastro. */
export function ReviewCard({
  icon,
  title,
  subtitle,
  empty,
  footer,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  /** mensagem quando não há nada a revisar (esconde o conteúdo) */
  empty?: string | null;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {empty ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {empty}
        </p>
      ) : (
        <>
          {children}
          {footer && <div className="mt-4 flex justify-end">{footer}</div>}
        </>
      )}
    </section>
  );
}
