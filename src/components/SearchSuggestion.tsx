'use client';

import { useMemo } from 'react';
import { productSearchFields, suggestFor } from '@/lib/smartSearch';

type SearchableProduct = Parameters<typeof productSearchFields>[0];

/** "Nenhum produto encontrado. Você quis dizer …?" — clicar aplica a sugestão. */
export function SearchSuggestion({
  products,
  query,
  onPick,
}: {
  products: SearchableProduct[];
  query: string;
  onPick: (q: string) => void;
}) {
  const suggestion = useMemo(() => (query.trim().length >= 3 ? suggestFor(products, query, productSearchFields) : null), [products, query]);
  if (!suggestion) return <>Nenhum produto encontrado.</>;
  return (
    <>
      Nenhum produto encontrado. Você quis dizer{' '}
      <button type="button" onClick={() => onPick(suggestion)} className="font-semibold text-primary underline-offset-2 hover:underline">
        {suggestion}
      </button>
      ?
    </>
  );
}
