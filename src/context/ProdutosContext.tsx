import { createContext, useContext, useState } from 'react';

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  preco: number;
  estoque: number;
}

const ProdutosContext = createContext<{
  produtos: Produto[];
  addProduto: (produto: Produto) => void;
  updateProduto: (id: string, produto: Partial<Produto>) => void;
  deleteProduto: (id: string) => void;
  findProdutoByCodigo: (codigo: string) => Produto | undefined;
}>({} as any);

export const ProdutosProvider = ({ children }: { children: React.ReactNode }) => {
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const addProduto = (produto: Produto) => {
    setProdutos([...produtos, produto]);
  };

  const updateProduto = (id: string, updates: Partial<Produto>) => {
    setProdutos(prev =>
      prev.map(p => p.id === id ? { ...p, ...updates } : p)
    );
  };

  const deleteProduto = (id: string) => {
    setProdutos(prev => prev.filter(p => p.id !== id));
  };

  const findProdutoByCodigo = (codigo: string) => {
    return produtos.find(p => p.codigo === codigo);
  };

  return (
    <ProdutosContext.Provider value={{
      produtos,
      addProduto,
      updateProduto,
      deleteProduto,
      findProdutoByCodigo
    }}>
      {children}
    </ProdutosContext.Provider>
  );
};

export const useProdutos = () => useContext(ProdutosContext);