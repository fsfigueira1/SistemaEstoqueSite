'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Trash2,
  DollarSign,
  CreditCard,
  PieChart,
  Users,
  Activity,
  Settings,
  Barcode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Menu,
  LogIn,
} from 'lucide-react';
import { ReceiptPrint } from '@/components/pdv/ReceiptPrint';
import Layout from '@/components/Layout';

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
  } | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const printedRef = useRef(false);

  // Efeitos
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (barcode.trim()) {
          handleScanBarcode();
        } else if (searchTerm.trim()) {
          handleSearch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [barcode, searchTerm]);

  // Funções
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
    setScannerStatus('ready');
  };

  const handleScanBarcode = async () => {
    if (!barcode.trim()) return;
    setScannerStatus('scanning');
    try {
      const res = await fetch(`/api/products/barcode/${barcode}`);
      const data = await res.json();
      if (data.success && data.data) {
        const product = data.data;
        if (product.stockQuantity <= 0) {
          setScannerStatus('not-found');
          setError('Produto sem estoque');
        } else {
          addToCart(product);
          setScannerStatus('added');
          setSuccess('Produto adicionado ao carrinho');
          if (inputRef.current) {
            inputRef.current.value = '';
            setBarcode('');
          }
        }
      } else {
        setScannerStatus('not-found');
        setError('Produto não encontrado');
      }
    } catch (err) {
      console.error('Erro ao buscar produto por barcode:', err);
      setScannerStatus('not-found');
      setError('Erro ao buscar produto');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const res = await fetch(`/api/products?search=${searchTerm}&limit=10`);
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResults(data.data.products || []);
        setHighlightedIndex(0);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      setSearchResults([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setHighlightedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        const product = searchResults[highlightedIndex];
        addToCart(product);
        setSearchResults([]);
        setHighlightedIndex(-1);
        setSearchTerm('');
        if (searchInputRef.current) {
          searchInputRef.current.value = '';
        }
        setScannerStatus('added');
        setSuccess('Produto adicionado ao carrinho');
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchResults([]);
      setHighlightedIndex(-1);
      setSearchTerm('');
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = carrinho.find((item) => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantidade < product.stockQuantity) {
        setCarrinho(
          carrinho.map((item) =>
            item.id === product.id
              ? { ...item, quantidade: item.quantidade + 1 }
              : item
          )
        );
      } else {
        setError('Estoque insuficiente');
        setScannerStatus('low-stock');
      }
    } else {
      setCarrinho([
        ...carrinho,
        {
          id: product.id,
          nome: product.name,
          codigo: product.sku,
          preco: product.salePrice,
          estoque: product.stockQuantity,
          quantidade: 1,
        },
      ]);
    }
  };

  const increaseQuantity = (index: number) => {
    setCarrinho(
      carrinho.map((item, i) =>
        i === index && item.quantidade < item.estoque
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    );
  };

  const decreaseQuantity = (index: number) => {
    setCarrinho(
      carrinho.map((item, i) =>
        i === index && item.quantidade > 1
          ? { ...item, quantidade: item.quantidade - 1 }
          : item
      )
    );
  };

  const removeFromCart = (index: number) => {
    setCarrinho(carrinho.filter((_, i) => i !== index));
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMetodoPagamento(e.target.value as 'dinheiro' | 'pix' | 'cartao');
    if (e.target.value !== 'cartao') {
      setParcelas(1);
    }
  };

  const handleParcelasChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setParcelas(parseInt(e.target.value, 10) || 1);
  };

  const calcularSubtotal = (): number => {
    return carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  };

  const calcularJuros = (): number => {
    if (metodoPagamento === 'cartao' && parcelas > 1) {
      // Juros fixo de 3,5% para parcelas > 1
      return calcularSubtotal() * 0.035;
    }
    return 0;
  };

  const calcularTotal = (): number => {
    return calcularSubtotal() + calcularJuros();
  };

  const finalizarVenda = async () => {
    if (carrinho.length === 0) {
      setError('Carrinho vazio');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Verificar se há sessão de caixa aberta
      const sessionRes = await fetch('/api/cash-session/current');
      const sessionData = await sessionRes.json();
      let cashSessionIdToUse = cashSessionId;

      if (!cashSessionIdToUse && sessionData.success && sessionData.data) {
        cashSessionIdToUse = sessionData.data.id;
        setCashSessionId(cashSessionIdToUse);
      }

      if (!cashSessionIdToUse) {
        // Tentar abrir sessão de caixa automaticamente
        const registersRes = await fetch('/api/cash-registers');
        const registersData = await registersRes.json();
        if (registersData.success && registersData.data && registersData.data.length > 0) {
          const register = registersData.data[0];
          const openRes = await fetch('/api/cash-session/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cashRegisterId: register.id,
              openingAmount: '0', // Valor de abertura zero para simplificar
            }),
          });
          const openData = await openRes.json();
          if (openData.success && openData.data) {
            cashSessionIdToUse = openData.data.id;
            setCashSessionId(cashSessionIdToUse);
          } else {
            throw new Error('Falha ao abrir sessão de caixa');
          }
        } else {
          throw new Error('Nenhum caixa configurado');
        }
      }

      // Preparar itens da venda
      const items = carrinho.map((item) => ({
        productId: item.id,
        quantity: item.quantidade,
        unitPrice: item.preco,
      }));

      const pagamento = {
        method: metodoPagamento,
        installments: metodoPagamento === 'cartao' ? parcelas : 1,
        amount: calcularTotal(),
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          payment: pagamento,
          cashSessionId: cashSessionIdToUse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || DEFAULT_ERROR_MESSAGE);
      }

      if (data.success && data.data) {
        const sale = data.data;
        setReceiptData({
          saleId: sale.id,
          date: new Date(sale.createdAt),
          items: sale.items.map((item: any) => ({
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.totalAmount,
          })),
          subtotal: sale.subtotal,
          paymentMethod: metodoPagamento,
          interest: sale.totalAmount - sale.subtotal,
          total: sale.totalAmount,
        });
        setShowReceiptModal(true);
        setSuccess('Venda finalizada com sucesso');
        setCarrinho([]);
        setBarcode('');
        setMetodoPagamento('dinheiro');
        setParcelas(1);
        // Limpar foco e retornar ao scanner
        setTimeout(() => {
          inputRef.current?.focus();
        }, 1000);
      } else {
        throw new Error(data.error || DEFAULT_ERROR_MESSAGE);
      }
    } catch (err) {
      console.error('Erro ao finalizar venda:', err);
      setError(err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGE);
    } finally {
      setIsProcessing(false);
    }
  };

  // Renderização
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">PDV - Ponto de Venda</h1>
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600">Sistema Online</span>
            </div>
            <span className="text-sm text-gray-500">
              {new Date().toLocaleString('pt-BR')}
            </span>
          </div>

        {/* Status messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
            <span>{success}</span>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Scanner and search */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Barcode className="mr-3 h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-gray-800">Leitor de Código de Barras</h2>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    ref={inputRef}
                    value={barcode}
                    onChange={handleBarcodeChange}
                    placeholder="Aproxime o leitor de código de barras ou digite manualmente..."
                    className="w-full px-4 py-3 pl-10 text-lg font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                    autoComplete="off"
                    onKeyDown={handleKeyDown}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <div className="text-sm text-gray-500">
                  Código de barras detectado: {barcode || 'Nenhum'}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium">
                    {scannerStatus === 'ready' && (
                      <span className="bg-green-100 text-green-800">Pronto para scan</span>
                    )}
                    {scannerStatus === 'scanning' && (
                      <span className="bg-yellow-100 text-yellow-800">Escaneando...</span>
                    )}
                    {scannerStatus === 'added' && (
                      <span className="bg-green-100 text-green-800">Produto adicionado!</span>
                    )}
                    {scannerStatus === 'not-found' && (
                      <span className="bg-red-100 text-red-800">Não encontrado</span>
                    )}
                    {scannerStatus === 'low-stock' && (
                      <span className="bg-orange-100 text-orange-800">Estoque baixo</span>
                    )}
                  </span>
              </div>

              {/* Search products */}
              <div className="mt-6 bg-white rounded-lg shadow p-6">
                <div className="flex items-center mb-4">
                  <Search className="mr-3 h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-gray-800">Busca de Produtos</h2>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome ou SKU do produto..."
                    className="w-full px-4 py-3 pl-10 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    onKeyDown={handleKeyDown}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {searchResults.map((product, index) => (
                      <div
                        key={product.id}
                        className={`flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 ${
                          index === highlightedIndex ? 'bg-primary/10' : ''
                        } cursor-pointer`}
                        onClick={() => {
                          addToCart(product);
                          setSearchResults([]);
                          setHighlightedIndex(-1);
                          setSearchTerm('');
                          if (searchInputRef.current) {
                            searchInputRef.current.value = '';
                          }
                          setScannerStatus('added');
                          setSuccess('Produto adicionado ao carrinho');
                          setTimeout(() => {
                            if (inputRef.current) {
                              inputRef.current.focus();
                            }
                          }, 100);
                        }}
                      >
                        <div className="mr-3">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{product.name}</p>
                          <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                          <p className="text-sm font-medium">{formatCurrency(product.salePrice)}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          Estoque: {product.stockQuantity}
                        </div>
                      </div>
                  ))}
                </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column - Cart and payment */}
          <div className="lg:col-span-1">
            {/* Cart */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center mb-4">
                <ShoppingCart className="mr-3 h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-gray-800">Carrinho ({carrinho.length} itens)</h2>
              </div>
              {carrinho.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="mx-auto h-8 w-8 text-gray-300 mb-3" />
                  <p className="text-gray-500">Seu carrinho está vazio</p>
                  <p className="text-sm text-gray-400">
                    Aproxime o leitor de código de barras ou use a busca para adicionar produtos
                  </p>
                </div>
              )
              : (
                <div className="space-y-4">
                  {carrinho.map((item, index) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-3 flex items-center space-x-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.nome}</p>
                        <p className="text-sm text-gray-500">Código: {item.codigo}</p>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <button
                          onClick={() => decreaseQuantity(index)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                          disabled={item.quantidade <= 1}
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.quantidade}</span>
                        <button
                          onClick={() => increaseQuantity(index)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                          disabled={item.quantidade >= item.estoque}
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right text-sm font-medium">
                        {formatCurrency(item.preco * item.quantidade)}
                      </div>
                      <div className="ml-2">
                        <button
                          onClick={() => removeFromCart(index)}
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                                    <div className="pt-4 border-t border-gray-200">
                                      <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Subtotal:</span>
                                        <span className="text-sm font-medium">{formatCurrency(calcularSubtotal())}</span>
                                      </div>
                                      {calcularJuros() > 0 && (
                                        <div className="flex justify-between mb-2">
                                          <span className="text-sm font-medium text-gray-600">Juros do cartão (3,5%):</span>
                                          <span className="text-sm font-medium">{formatCurrency(calcularJuros())}</span>
                                        </div>
                                      )}
                                    </div>
                                      <div className="flex justify-between pt-2 border-t border-gray-300">
                                        <span className="text-xl font-bold text-gray-800">Total:</span>
                                        <span className="text-xl font-bold text-primary">{formatCurrency(calcularTotal())}</span>
                                      </div>
                                    </div>
              )}
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center mb-4">
                <CreditCard className="mr-3 h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-gray-800">Forma de Pagamento</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Selecione a forma de pagamento</label>
                  <select
                    value={metodoPagamento}
                    onChange={handlePaymentMethodChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão de Crédito</option>
                  </select>
                </div>
                {metodoPagamento === 'cartao' && (
                                  <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Número de parcelas</label>
                                    <select
                                      value={parcelas.toString()}
                                      onChange={handleParcelasChange}
                                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                    >
                                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((parcela) => (
                                        <option key={parcela} value={parcela.toString()}>
                                          {parcela}x
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
              </div>

            {/* Finalize button */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Zap className="mr-3 h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-gray-800">Finalizar Venda</h2>
              </div>
              <button
                onClick={finalizarVenda}
                disabled={isProcessing || carrinho.length === 0}
                className="w-full px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
  {isProcessing ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Finalizando...
    </>
    ) : (
      'Finalizar Venda'
    )}
      </button>
      </div>
    </div>

      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Comprovante de Venda</h2>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptData(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XCircle className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <ReceiptPrint
              data={receiptData}
              onPrintComplete={() => {
                setShowReceiptModal(false);
                setReceiptData(null);
              }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  </div>
</div>
</Layout>
  );
}

// Helper components for icons not in lucide-react (if needed)
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function Search({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}