'use client';

import { useState, useEffect, useRef } from 'react';
import { ShoppingCart } from 'lucide-react';
import { ReceiptPrint } from '@/components/pdv/ReceiptPrint';

// Constants
const DEFAULT_ERROR_MESSAGE = 'Erro desconhecido ao finalizar venda';

// ----- Helpers -----
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const result = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(result) ? result : 0;
  }
  return 0;
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));
}


// ----- Tipos -----
type CartItem = {
  id: string;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  quantidade: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  stockQuantity: number;
};

// ----- Componente Principal -----
export default function PDVPage() {
  // Estados
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState<'dinheiro' | 'pix' | 'cartao'>('dinheiro');
  const [parcelas, setParcelas] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [scannerStatus, setScannerStatus] = useState<'ready' | 'scanning' | 'added' | 'not-found' | 'low-stock'>('ready');
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const [showOpenCashSessionDialog, setShowOpenCashSessionDialog] = useState(false);
  const [availableCashRegisters, setAvailableCashRegisters] = useState<Array<{id: string, name: string}>>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  // Receipt printing states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    saleId: string;
    date: Date;
    items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    paymentMethod: 'dinheiro' | 'pix' | 'cartao';
    interest: number;
    total: number;
    installments?: number;
    installmentValue?: number;
  } | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barcodeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Computado
  const subtotal = carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  const juros = metodoPagamento === 'cartao' ? subtotal * 0.035 : 0;
  const totalComJuros = subtotal + juros;

  // Focus no campo de código ao montar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup barcode timeout on unmount
  useEffect(() => {
    return () => {
      if (barcodeTimeout.current !== null) {
        clearTimeout(barcodeTimeout.current);
      }
    };
  }, []);

  // Fetch open cash session for current user on mount
  useEffect(() => {
    const fetchOpenCashSession = async () => {
      setError(null);

      try {
        const res = await fetch('/api/cash-session/current');
        const data = await res.json();

        if (!data.success) {
          setError(data.error?.message || 'Erro ao verificar sessão de caixa');
          return;
        }

        if (data.data) {
          setCashSessionId(data.data.id);
        } else {
          // No open session - show dialog to open one
          setError('Não existe uma sessão de caixa aberta. Abra o caixa antes de finalizar a venda.');

          // Fetch available cash registers
          try {
            const registersRes = await fetch('/api/cash-session/open');
            const registersData = await registersRes.json();
            if (registersData.success && registersData.data) {
              setAvailableCashRegisters(registersData.data);
              if (registersData.data.length > 0) {
                setSelectedCashRegisterId(registersData.data[0].id);
              }
            }
          } catch (registerErr) {
            console.error('Erro ao buscar caixas:', registerErr);
          }

          setShowOpenCashSessionDialog(true);
        }
      } catch (err) {
        console.error('Erro ao buscar sessão de caixa:', err);
        setError('Erro ao verificar sessão de caixa. Por favor, tente novamente.');
      }
    };

    fetchOpenCashSession();
  }, []);

  // Function to open a new cash session
  const openCashSession = async () => {
    if (!selectedCashRegisterId || !openingAmount) {
      setError('Selecione um caixa e informe o valor de abertura');
      return;
    }

    setIsOpeningSession(true);
    setError(null);

    try {
      const res = await fetch('/api/cash-session/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashRegisterId: selectedCashRegisterId,
          openingAmount: Number(openingAmount)
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Erro ao abrir sessão de caixa');
      }

      // Success - set the cash session ID and close dialog
      setCashSessionId(data.data.id);
      setShowOpenCashSessionDialog(false);
      setSuccess('Sessão de caixa aberta com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erro ao abrir sessão de caixa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao abrir sessão de caixa');
    } finally {
      setIsOpeningSession(false);
    }
  };

  // ----- Leitor de código de barras (USB) -----
  // Valid barcode lengths found in database (EAN-13, EAN-8, UPC-A, Code-128, etc.)
  const MIN_BARCODE_LENGTH = 8;
  const MAX_BARCODE_LENGTH = 20;

  // Process barcode when complete code is detected
  const processBarcode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || isProcessing) return;

    // Validate barcode length to avoid processing partial codes
    if (cleanCode.length < MIN_BARCODE_LENGTH || cleanCode.length > MAX_BARCODE_LENGTH) {
      return; // Silently ignore invalid lengths
    }

    setIsProcessing(true);
    setScannerStatus('scanning');

    try {
      const res = await fetch(`/api/products/barcode/${cleanCode}`);
      const result = await res.json();

      if (result.success && result.data) {
        const product = {
          id: result.data.id,
          nome: result.data.name,
          codigo: result.data.sku,
          preco: toNumber(result.data.salePrice),
          custo: toNumber(result.data.costPrice),
          estoque: result.data.stockQuantity || 0,
          quantidade: 1,
        };

        if (product.estoque <= 0) {
          setScannerStatus('low-stock');
          setError(`Produto ${product.nome} sem estoque!`);
          return;
        }

        // Verificar se já está no carrinho
        const existingIndex = carrinho.findIndex((item) => item.id === product.id);
        if (existingIndex >= 0) {
          const newQtd = carrinho[existingIndex].quantidade + 1;
          if (newQtd > product.estoque) {
            setScannerStatus('low-stock');
            setError(`Estoque insuficiente! Disponível: ${product.estoque}`);
            return;
          }
          setCarrinho((prev) =>
            prev.map((item, idx) =>
              idx === existingIndex ? { ...item, quantidade: newQtd } : item
            )
          );
        } else {
          setCarrinho((prev) => [...prev, {
            id: product.id,
            nome: product.nome,
            codigo: product.codigo,
            preco: product.preco,
            estoque: product.estoque,
            quantidade: 1
          }]);
        }

        setScannerStatus('added');
        setSuccess(`${product.nome} adicionado!`);
      } else {
        setScannerStatus('not-found');
        setError('Produto não encontrado com este código');
      }
    } catch (err) {
      console.error(err);
      setScannerStatus('not-found');
      setError('Erro ao buscar produto');
    } finally {
      setIsProcessing(false);
      // Small delay to show status before resetting
      setTimeout(() => {
        setScannerStatus('ready');
        setSuccess(null);
        setError(null);
      }, 1500);
    }
  };

  // Handle barcode input changes - Smart debounce for USB scanner vs manual typing
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcode(value);

    // Clear existing timeout
    if (barcodeTimeout.current !== null) {
      clearTimeout(barcodeTimeout.current);
    }

    // Set new timeout to process barcode after inactivity (debounce)
    // USB scanners typically send complete codes within 10-50ms
    // Manual typing has pauses > 300ms between characters
    barcodeTimeout.current = setTimeout(() => {
      const code = value.trim();
      // Only process if code looks complete (valid length and not currently typing)
      if (code && code.length >= MIN_BARCODE_LENGTH && code.length <= MAX_BARCODE_LENGTH) {
        processBarcode(code);
        // Clear input after successful processing
        setBarcode('');
      }
    }, 300); // 300ms debounce - waits for input to settle
  };

  // Handle key presses for barcode input (Enter as fallback)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = e.currentTarget.value.trim();
      if (code) {
        processBarcode(code);
        // Clear after processing
        setBarcode('');
      }
    }
  };

  // ----- Busca com autocomplete (debounce) -----
  useEffect(() => {
    const handleSearch = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        setHighlightedIndex(-1);
        return;
      }

      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        if (data.success && data.data?.products) {
          // API already filters by search term, just limit results
          setSearchResults(data.data.products.slice(0, 8));
          setHighlightedIndex(-1);
        } else {
          setSearchResults([]);
          setHighlightedIndex(-1);
        }
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setHighlightedIndex(-1);
      }
    };

    // Debounce: wait 300ms before executing search
    const handler = setTimeout(handleSearch, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // ----- Adicionar produto da busca -----
  const addProductFromSearch = (product: Product) => {
    const novoItem = {
      id: product.id,
      nome: product.name,
      codigo: product.sku,
      preco: toNumber(product.salePrice),
      estoque: product.stockQuantity || 0,
      quantidade: 1,
    };

    if (novoItem.estoque <= 0) {
      setError(`Produto ${novoItem.nome} sem estoque!`);
      return;
    }

    const existingIndex = carrinho.findIndex((item) => item.id === product.id);
    if (existingIndex >= 0) {
      const newQtd = carrinho[existingIndex].quantidade + 1;
      if (newQtd > product.stockQuantity) {
        setError(`Estoque insuficiente! Disponível: ${product.stockQuantity}`);
        return;
      }
      setCarrinho((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantidade: newQtd } : item
        )
      );
    } else {
      setCarrinho((prev) => [...prev, novoItem]);
    }

    setSuccess(`${novoItem.nome} adicionado!`);
    setSearchTerm('');
    setSearchResults([]);
    setTimeout(() => setSuccess(null), 2000);
  };

  // ----- Remover item do carrinho -----
  const removerItem = (id: string) => {
    setCarrinho((prev) => prev.filter((item) => item.id !== id));
  };

  // ----- Finalizar venda -----
  const finalizarVenda = async () => {
    if (isProcessing) return;
    if (carrinho.length === 0) {
      setError('Carrinho vazio');
      return;
    }

    // Check if we have a cash session ID
    if (!cashSessionId) {
      setError('Não existe uma sessão de caixa aberta. Abra o caixa antes de finalizar a venda.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        paymentMethod: metodoPagamento.toUpperCase(),
        items: carrinho.map((item) => ({
          productId: item.id,
          quantity: item.quantidade,
          unitPrice: item.preco,
        })),
        discount: 0,
        cashSessionId: cashSessionId, // Use the actual cash session ID
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle standardized API error responses
        let errorMessage = 'Erro ao finalizar venda';
        if (data.error && typeof data.error === 'object' && data.error.message) {
          errorMessage = data.error.message;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = String(data.error);
        }
        throw new Error(errorMessage);
      }

      // Se a venda foi criada, tentar completar (se necessário)
      if (data.data && data.data.id) {
        const completeRes = await fetch(`/api/sales/${data.data.id}/complete`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: metodoPagamento.toUpperCase(),
            amount: metodoPagamento === 'cartao' ? totalComJuros : subtotal,
          }),
        });
        if (!completeRes.ok) {
          const errData = await completeRes.json();
          console.warn('Erro ao completar venda:', errData);
        }
      }

      // Prepare receipt data for printing
      const newReceiptData = {
        saleId: data.data.id,
        date: new Date(),
        items: carrinho.map((item) => ({
          name: item.nome,
          quantity: item.quantidade,
          unitPrice: item.preco,
          total: item.preco * item.quantidade,
        })),
        subtotal,
        paymentMethod: metodoPagamento,
        interest: juros,
        total: metodoPagamento === 'cartao' ? totalComJuros : subtotal,
        installments: metodoPagamento === 'cartao' ? parcelas : undefined,
        installmentValue: metodoPagamento === 'cartao' && parcelas > 1 ? totalComJuros / parcelas : undefined,
      };

      setReceiptData(newReceiptData);
      setShowReceiptModal(true);
      setCarrinho([]);
    } catch (err) {
      // Properly type the error as unknown and narrow it down
      console.error('Erro ao finalizar venda:', err);
      // Show user-friendly error message - handle various API error formats
      let errorMessage = DEFAULT_ERROR_MESSAGE;

      if (err != null && typeof err === 'object' && 'response' in err) {
        // Handle standardized API error responses
        const apiError = err as { response: { data: unknown } };
        if (apiError.response && typeof apiError.response === 'object' && apiError.response !== null) {
          const data = apiError.response.data;
          if (data != null && typeof data === 'object' && 'error' in data && typeof data.error === 'object' && data.error != null && 'message' in data.error) {
            errorMessage = String(data.error.message);
          } else if (data != null && typeof data === 'object' && 'message' in data && data.message != null) {
            errorMessage = String(data.message);
          } else if (data != null && typeof data === 'object' && 'error' in data && data.error != null) {
            errorMessage = String(data.error);
          }
        }
      } else if (err != null && typeof err === 'object' && 'message' in err && err.message != null) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };


  // ----- Keyboard navigation for search results -----
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prevHighlightedIndex: number) => {
        return (prevHighlightedIndex + 1) % searchResults.length;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prevHighlightedIndex: number) => {
        const newIndex = prevHighlightedIndex - 1;
        return newIndex < 0 ? searchResults.length - 1 : newIndex;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        addProductFromSearch(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchResults([]);
      setHighlightedIndex(-1);
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
      setSearchTerm('');
    }
  };

  // ----- UI auxiliar -----
  const getScannerColor = (status: typeof scannerStatus) => {
    switch (status) {
      case 'ready': return 'bg-gray-300';
      case 'scanning': return 'bg-blue-400 animate-pulse';
      case 'added': return 'bg-green-500';
      case 'not-found': return 'bg-red-500';
      case 'low-stock': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };

  // ----- JSX -----
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">PDV - Ponto de Venda</h1>
          <p className="text-sm text-gray-500">Escaneie produtos ou pesquise por nome/SKU</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Busca por nome/SKU */}
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar produto por nome ou SKU
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Digite o nome ou SKU..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  disabled={isProcessing}
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg z-10">
                    <table className="min-w-full divide-y divide-gray-200">
                      <tbody className="divide-y divide-gray-200">
                        {searchResults.map((product) => {
                          const existingItem = carrinho.find((item) => item.id === product.id);
                          return (
                            <tr key={product.id}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {product.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-center font-medium">
                                {existingItem ? existingItem.quantidade : 0}
                              </td>
                              <td className="px-4 py-2 text-sm text-center">
                                {formatCurrency(product.salePrice)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                <button
                                  onClick={() => addProductFromSearch(product)}
                                  className="text-emerald-600 hover:text-emerald-800 text-sm"
                                >
                                  {existingItem ? 'Adicionar +1' : 'Adicionar'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Leitor de código de barras */}
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de Barras (digite ou use leitor USB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Aponte o leitor ou digite manualmente..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={barcode}
                  onChange={handleBarcodeChange}
                  onKeyDown={handleBarcodeKeyDown}
                  disabled={isProcessing}
                />
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getScannerColor(scannerStatus)}`} />
                  <span className="text-xs text-gray-500">
                    {scannerStatus === 'ready' ? 'Pronto' :
                     scannerStatus === 'scanning' ? 'Lendo...' :
                     scannerStatus === 'added' ? 'Adicionado!' :
                     scannerStatus === 'not-found' ? 'Não encontrado' :
                     'Estoque baixo'}
                  </span>
                </div>
              </div>
            </div>

            {/* Carrinho */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Carrinho de Vendas</h2>
              </div>

              {carrinho.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  Carrinho vazio. Adicione produtos.
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Preço</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {carrinho.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.nome}
                            </td>
                            <td className="px-4 py-2 text-sm text-center font-medium">
                              {item.quantidade}
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              {formatCurrency(item.preco)}
                            </td>
                            <td className="px-4 py-2 text-sm text-center font-bold">
                              {formatCurrency(item.preco * item.quantidade)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right">
                              <button
                                onClick={() => removerItem(item.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t bg-gray-50">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {metodoPagamento === 'cartao' && (
                      <>
                        <div className="justify-between text-sm text-red-600">
                          <span>Juros (3.5%):</span>
                          <span>{formatCurrency(juros)}</span>
                        </div>
                        <div className="justify-between text-lg font-bold border-t pt-2 mt-2">
                          <span>Total com juros:</span>
                          <span>{formatCurrency(totalComJuros)}</span>
                        </div>
                      </>
                    )}
                    {metodoPagamento !== 'cartao' && (
                      <div className="justify-between text-lg font-bold border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita (1/3): pagamento e ações */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Forma de Pagamento</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pagamento"
                    value="dinheiro"
                    checked={metodoPagamento === 'dinheiro'}
                    onChange={() => setMetodoPagamento('dinheiro')}
                  />
                  Dinheiro
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pagamento"
                    value="pix"
                    checked={metodoPagamento === 'pix'}
                    onChange={() => setMetodoPagamento('pix')}
                  />
                  PIX
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pagamento"
                    value="cartao"
                    checked={metodoPagamento === 'cartao'}
                    onChange={() => setMetodoPagamento('cartao')}
                  />
                  Cartão
                </label>
              </div>

              {metodoPagamento === 'cartao' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                  <select
                    value={parcelas}
                    onChange={(e) => setParcelas(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>

                  {/* Display installment value */}
                  {parcelas > 1 && (
                    <div className="mt-2 text-sm text-gray-600">
                    <span>Valor da parcela: </span>
                    <span className="font-medium">{formatCurrency(totalComJuros / parcelas)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={finalizarVenda}
              disabled={isProcessing || carrinho.length === 0}
              className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'PROCESSANDO...' : 'FINALIZAR VENDA'}
            </button>

            <button
              onClick={() => setCarrinho([])}
              className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Limpar Carrinho
            </button>
          </div>
        </div>

        {/* Mensagens de erro/sucesso */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Dialog: Abrir Caixa */}
        {showOpenCashSessionDialog && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setShowOpenCashSessionDialog(false)} />
              <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Abrir Caixa</h2>
                <p className="text-gray-600 mb-6">Não existe sessão de caixa aberta. Selecione o caixa e informe o valor de abertura.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Caixa</label>
                    <select
                      value={selectedCashRegisterId}
                      onChange={(e) => setSelectedCashRegisterId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      disabled={isOpeningSession}
                    >
                      {availableCashRegisters.map((register) => (
                        <option key={register.id} value={register.id}>
                          {register.name}
                        </option>
                      ))}
                    </select>
                    {availableCashRegisters.length === 0 && (
                      <p className="mt-1 text-sm text-red-600">Nenhum caixa ativo disponível</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Abertura (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0,00"
                      disabled={isOpeningSession}
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowOpenCashSessionDialog(false)}
                    disabled={isOpeningSession}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={openCashSession}
                    disabled={isOpeningSession || !selectedCashRegisterId || !openingAmount}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {isOpeningSession ? 'ABRINDO...' : 'ABRIR CAIXA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dialog: Impressão de Comprovante */}
        {showReceiptModal && receiptData && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setShowReceiptModal(false)} />
              <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Venda Finalizada!</h2>
                <p className="text-gray-600 mb-6">
                  A venda foi concluída com sucesso. Deseja imprimir o comprovante?
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setShowReceiptModal(false);
                      setReceiptData(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Não Imprimir
                  </button>
                  <button
                    onClick={() => {
                      setShowReceiptModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Imprimir Comprovante
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print-only Receipt Component */}
        {receiptData && !showReceiptModal && (
          <div className="receipt-print-container" style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}>
            <ReceiptPrint data={receiptData} onPrintComplete={() => setReceiptData(null)} />
          </div>
        )}
      </div>
    </div>
  );
}