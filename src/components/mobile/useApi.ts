'use client';

import { useEffect, useState } from 'react';

type State<T> = { data: T | null; loading: boolean; error: string | null };

/** GET simples num endpoint interno, com estado de carregando/erro. */
export function useApi<T = unknown>(url: string): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setState({ data: json.data ?? json, loading: false, error: null });
      } catch (err) {
        if (alive)
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Erro' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}
