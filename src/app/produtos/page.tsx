'use client';

import { useState, useEffect, useRef } from 'react';
import { ProductStatus } from '@/generated/prisma/enums';
import Layout from '@/components/Layout';

// ---------- Helper functions ----------
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value));
}

// Normalise search terms: lowercase, remove accents
function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Define types for our API responses
interface ProductResponse {
  success: boolean;
  data?: {
    products?: Product[];
    categories?: Category[];
  };
  error?: {
    message?: string;
  };
}

interface CategoryResponse {
  success: boolean;
  data?: {
    categories?: Category[];
  };
  error?: {
    message?: string;
  };
}

interface Product {
  id: string;
  sku?: string;
  codigo?: string;
  name?: string;
  nome?: string;
  categoryId?: string;
  categoriaId?: string;
  salePrice?: number;
  preco?: number;
  costPrice?: number;
  custo?: number;
  stockQuantity?: number;
  estoque?: number;
  minStockLevel?: number;
  estoqueMinimo?: number;
  status: ProductStatus;
}

interface Category {
  id: string;
  name?: string;
  nome?: string;
}

// ---------- Main component ----------
export default function ProdutosPage() {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'discontinued'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'normal' | 'low' | 'out'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<{
    codigo: string;
    nome: string;
    categoriaId: string;
    preco: number;
    custo: number;
    estoque: number;
    estoqueMinimo: number;
    status: ProductStatus;
  }>({
    codigo: '',
    nome: '',
    categoriaId: '',
    preco: 0,
    custo: 0,
    estoque: 0,
    estoqueMinimo: 5,
    status: ProductStatus.ACTIVE,
  });

  // Validation errors state
  const [formErrors, setFormErrors] = useState<{
    codigo?: string;
    nome?: string;
    categoriaId?: string;
    preco?: string;
    estoque?: string;
    custo?: string;
    estoqueMinimo?: string;
    status?: string;
  }>({});
  const [scannerStatus, setScannerStatus] = useState<'ready' | 'scanning' | 'added' | 'not-found'>('ready');
    const [loading, setLoading] = useState(true);
    const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load initial data
    useEffect(() => {
      const loadData = async () => {
        try {
          const [productsRes, categoriesRes] = await Promise.all([
            fetch('/api/products'),
            fetch('/api/categories'),
          ]);
          const productsData: ProductResponse = await productsRes.json();
          const categoriesData: CategoryResponse = await categoriesRes.json();
          if (productsData.success) {
            setProducts(productsData.data?.products || []);
          }
          if (categoriesData.success) {
            setCategories(categoriesData.data?.categories || []);
          }
        } catch (error) {
          console.error('Error loading products or categories:', error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, []);

    // Focus logic for input after modal open/close
    useEffect(() => {
      if (modalOpen) {
        inputRef.current?.focus();
      }
    }, [modalOpen]);

    // Process barcode when complete code is detected
    const processBarcode = async (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      setScannerStatus('scanning');

      try {
        const response = await fetch(`/api/products/barcode/${encodeURIComponent(cleanCode)}`);
        const result = await response.json();
        if (result.success && result.data) {
          const produto = result.data as Product;
          setSelectedProduct(produto);
          setMode('edit');
          setFormData({
            codigo: produto.sku || produto.codigo || '',
            nome: produto.name || produto.nome || '',
            categoriaId: produto.categoryId || produto.categoriaId || '',
            preco: produto.salePrice || produto.preco || 0,
            custo: produto.costPrice || produto.custo || 0,
            estoque: produto.stockQuantity || produto.estoque || 0,
            estoqueMinimo: produto.minStockLevel || produto.estoqueMinimo || 5,
            status: produto.status || ProductStatus.ACTIVE,
          });
          setModalOpen(true);
          setScannerStatus('added');
        } else {
          // Product not found → prepare to add new one
          setSelectedProduct(null);
          setMode('add');
          setFormData({
            codigo: cleanCode,
            nome: '',
            categoriaId: '',
            preco: 0,
            custo: 0,
            estoque: 0,
            estoqueMinimo: 5,
            status: ProductStatus.ACTIVE,
          });
          setSearchTerm(''); // Clear the input after preparing to add
          setModalOpen(true);
          setScannerStatus('not-found');
        }
      } catch (err) {
        setScannerStatus('not-found');
        console.error('Barcode processing error:', err);
      } finally {
        // Small delay to show status before resetting
        setTimeout(() => {
          setScannerStatus('ready');
        }, 1500);
      }
    };

    // Handle barcode input changes - Smart debounce for USB scanner vs manual typing
    const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchTerm(value);

      // Clear existing timeout
      if (barcodeTimeoutRef.current !== null) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Set new timeout to process barcode after inactivity (debounce)
      // USB scanners typically send complete codes within 10-50ms
      // Manual typing has pauses > 300ms between characters
      barcodeTimeoutRef.current = setTimeout(() => {
        const code = value.trim();
        if (code) {
          void processBarcode(code);
        }
      }, 300); // 300ms debounce - waits for input to settle
    };

    // Handle key presses for barcode input (Enter as fallback)
    const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (barcodeTimeoutRef.current !== null) {
          clearTimeout(barcodeTimeoutRef.current);
          barcodeTimeoutRef.current = null;
        }
        const code = e.currentTarget.value.trim();
        if (code) {
          void processBarcode(code);
        }
      }
    };

  // Reset scanner status after a short delay
  useEffect(() => {
    if (scannerStatus !== 'ready') {
      const reset = setTimeout(() => {
        setScannerStatus('ready');
      }, 1500);
      return () => clearTimeout(reset);
    }
  }, [scannerStatus]);

  // ---------- CRUD handlers ----------
  const handleSubmit = async () => {
    // Validate form fields inline
    const newErrors: {
      codigo?: string;
      nome?: string;
      categoriaId?: string;
      preco?: string;
      estoque?: string;
      custo?: string;
      estoqueMinimo?: string;
      status?: string;
    } = {};

    if (!formData.codigo?.trim()) {
      newErrors.codigo = 'Código/SKU é obrigatório';
    }
    if (!formData.nome?.trim()) {
      newErrors.nome = 'Nome do produto é obrigatório';
    }
    if (!formData.categoriaId?.trim()) {
      newErrors.categoriaId = 'Selecione uma categoria';
    }
    if (formData.preco < 0) {
      newErrors.preco = 'Preço não pode ser negativo';
      return;
    }
    if (formData.estoque < 0) {
      newErrors.estoque = 'Estoque não pode ser negativo';
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      // Focus first invalid field
      const firstError = Object.keys(newErrors)[0];
      const input = document.querySelector(`[name="${firstError}"]`) as HTMLElement;
      input?.focus();
      return;
    }

    // Clear errors on valid submit
    setFormErrors({});

    try {
      const payload = {
        codigo: formData.codigo,
        nome: formData.nome,
        categoriaId: formData.categoriaId,
        preco: toNumber(formData.preco),
        custo: toNumber(formData.custo),
        estoque: toNumber(formData.estoque),
        estoqueMinimo: toNumber(formData.estoqueMinimo),
        status: formData.status,
      };

      const url = mode === 'add' ? '/api/products' : `/api/products/${selectedProduct?.id}`;
      const method = mode === 'add' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        // Handle any unexpected backend validation errors
        if (result.error?.message) {
          const newErrors: { [key: string]: string } = {};
          newErrors.base = result.error.message || "Erro de validação";
          setFormErrors(newErrors);
          return;
        }
        return;
      }

      // Refresh product list
      const freshRes = await fetch('/api/products');
      const freshData = await freshRes.json();
      if (freshData.success) {
        setProducts(freshData.data?.products || []);
      }

      setModalOpen(false);
      setFormData({
        codigo: '',
        nome: '',
        categoriaId: '',
        preco: 0,
        custo: 0,
        estoque: 0,
        estoqueMinimo: 5,
        status: ProductStatus.ACTIVE,
      });
      setFormErrors({});
    } catch (error) {
      console.error("Error submitting product form:", error);
      const newErrors: { [key: string]: string } = {};
      newErrors.base = "Erro ao salvar produto";
      setFormErrors(newErrors);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        const freshRes = await fetch('/api/products');
        const freshData = await freshRes.json();
        if (freshData.success) {
          setProducts(freshData.data?.products || []);
        }
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData({
      codigo: '',
      nome: '',
      categoriaId: '',
      preco: 0,
      custo: 0,
      estoque: 0,
      estoqueMinimo: 5,
      status: ProductStatus.ACTIVE,
    });
    setFormErrors({});
    setSelectedProduct(null);
  };

  // ---------- Derived lists ----------
  const filteredProducts = products.filter((p) => {
    // Text search (partial, case‑insensitive, accent‑insensitive)
    if (searchTerm && !normalizeSearch(p.name || p.nome || p.codigo || p.sku).includes(normalizeSearch(searchTerm))) {
      return false;
    }
    // Status filter
    if (statusFilter !== 'all') {
      const statusOk = p.status === ProductStatus.ACTIVE && statusFilter === 'active' ||
        p.status === ProductStatus.INACTIVE && statusFilter === 'inactive' ||
        p.status === ProductStatus.DISCONTINUED && statusFilter === 'discontinued';
      if (!statusOk) return false;
    }
    // Stock filter
    if (stockFilter !== 'all') {
      const stock = toNumber(p.stockQuantity ?? p.estoque ?? 0);
      const min = toNumber(p.minStockLevel ?? p.estoqueMinimo ?? 5);
      const isLow = stock > 0 && stock <= min;
      const isOut = stock === 0;
      if (stockFilter === 'normal' && (!isLow && !isOut)) return false;
      if (stockFilter === 'low' && !isLow) return false;
      if (stockFilter === 'out' && !isOut) return false;
    }
    return true;
  });

  // ---------- Render ----------
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laçolaria - Gestão de Produtos</h1>
          <p className="text-sm text-gray-600">Controle completo do seu catálogo de produtos</p>
        </div>

        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md text-sm">
            <div className={`h-2.5 w-2.5 rounded-full ${scannerStatus === 'ready' ? 'bg-green-500' : scannerStatus === 'scanning' ? 'bg-blue-500' : scannerStatus === 'added' ? 'bg-emerald-500' : scannerStatus === 'not-found' ? 'bg-red-500' : 'bg-gray-400'}`}></div>
            <span id="scanner-status-text" className={scannerStatus === 'ready' ? 'text-green-700' : scannerStatus === 'scanning' ? 'text-blue-700' : scannerStatus === 'added' ? 'text-emerald-700' : scannerStatus === 'not-found' ? 'text-red-700' : 'text-gray-700'}>
              {scannerStatus === 'ready' ? 'LEITOR PRONTO' : scannerStatus === 'scanning' ? 'LENDO CÓDIGO...' : scannerStatus === 'added' ? 'PRODUTO ENCONTRADO' : scannerStatus === 'not-found' ? 'PRODUTO NÃO ENCONTRADO' : ''}
            </span>
          </div>
          <button
            onClick={() => {
              setFormData({
                codigo: '',
                nome: '',
                categoriaId: '',
                preco: 0,
                custo: 0,
                estoque: 0,
                estoqueMinimo: 5,
                status: ProductStatus.ACTIVE,
              });
              setFormErrors({});
              setMode('add');
              setSelectedProduct(null);
              setModalOpen(true);
            }}
            disabled={false}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Adicionar Produto
          </button>
        </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full border-4 border-t-emerald-600 border-b-transparent w-12 h-12"></div>
            <p className="mt-4 text-sm text-gray-500">Carregando produtos...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Search & Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Busca por nome, código ou código de barras</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleBarcodeChange}
                      onKeyDown={handleBarcodeKeyDown}
                      placeholder="Digite para buscar produtos..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    {formErrors.estoque && (
                      <p className="text-sm text-red-600" role="alert">{formErrors.estoque}</p>
                    )}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4">
                      <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 15h2m-3 4h2" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'discontinued')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {formErrors.estoque && (
                      <p className="text-sm text-red-600" role="alert">{formErrors.estoque}</p>
                    )}
                    <option value="all">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="discontinued">Descontinuados</option>
                  </select>
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por estoque</label>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as 'all' | 'normal' | 'low' | 'out')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {formErrors.estoque && (
                      <p className="text-sm text-red-600" role="alert">{formErrors.estoque}</p>
                    )}
                    <option value="all">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="out">Esgotado</option>
                  </select>
                  </div>

                <div className="flex items-end">
                  <button
                    onClick={() => setModalOpen(true)}
                    disabled={false}
                    className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Adicionar Produto
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-emerald-500/20 flex items-center justify-center rounded-lg">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2zm0 10c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2zm0-6c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Estoque Baixo</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {products
                        .filter((p) => {
                          const stock = toNumber(p.stockQuantity ?? p.estoque ?? 0);
                          const min = toNumber(p.minStockLevel ?? p.estoqueMinimo ?? 5);
                          return stock > 0 && stock <= min;
                        }).length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-emerald-500/20 flex items-center justify-center rounded-lg">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m2 0a2 2 0 100-4 2 2 0 000 4 2 2 0 000 4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sem Estoque</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {products.filter((p) => toNumber(p.stockQuantity ?? p.estoque ?? 0) === 0).length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-emerald-500/20 flex items-center justify-center rounded-lg">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 15l2-2m0 0l2-2m-2 2l-2 8l2-2m0 0l2 2m-2-2l-2-2m2 8l-2-2m-2 2l2-2m2 8l-2-2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Valor do Estoque</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        products.reduce((sum: number, p) => sum + (toNumber(p.salePrice ?? p.preco) * toNumber(p.stockQuantity ?? p.estoque)), 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Lista de Produtos</h2>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2.5 w-2.5 bg-pale-gold/20 text-pale-gold rounded-full flex items-center justify-center text-xs font-medium">
                    {products.length}
                  </div>
                  <span className="text-gray-600">produtos</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código de Barras</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estoques Mín.</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const estoque = toNumber(product.stockQuantity ?? product.estoque ?? 0);
                      const estoqueMinimo = toNumber(product.minStockLevel ?? product.estoqueMinimo ?? 5);

                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name || product.nome}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-700">{product.sku || product.codigo}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {(() => {
                              const cat = categories.find(
                                (c) => c.id === (product.categoryId || product.categoriaId)
                              );
                              return cat?.name || cat?.nome || 'Sem categoria';
                            })()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {formatCurrency(product.salePrice ?? product.preco)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {estoque}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{estoqueMinimo}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <span className={`px-2 py-1 text-xs rounded-full ${product.status === ProductStatus.ACTIVE ? 'bg-green-100 text-green-800' : product.status === ProductStatus.INACTIVE ? 'bg-yellow-100 text-yellow-800' : product.status === ProductStatus.DISCONTINUED ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                              {product.status === ProductStatus.ACTIVE ? 'Ativo' : product.status === ProductStatus.INACTIVE ? 'Inativo' : product.status === ProductStatus.DISCONTINUED ? 'Descontinuado' : 'Desconhecido'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm space-x-2">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setMode('edit');
                                setFormData({
                                  codigo: product.sku || product.codigo || '',
                                  nome: product.name || product.nome || '',
                                  categoriaId: product.categoryId || product.categoriaId || '',
                                  preco: Number(toNumber(product.salePrice || product.preco)),
                                  custo: Number(toNumber(product.costPrice || product.custo)),
                                  estoque: Number(toNumber(product.stockQuantity || product.estoque)),
                                  estoqueMinimo: Number(toNumber(product.minStockLevel || product.estoqueMinimo)) || 5,
                                  status: product.status || ProductStatus.ACTIVE,
                                });
                                setFormErrors({});
                                setModalOpen(true);
                              }}
                              className="px-3 py-1.5 text-sm font-medium bg-pale-gold/20 text-pale-gold rounded hover:bg-pale-gold/30 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="px-3 py-1.5 text-sm font-medium bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                          Nenhum produto encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal for adding/editing product */}
            {modalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">
                      {mode === 'add' ? 'Adicionar Novo Produto' : 'Editar Produto'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Código de Barras */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Código de Barras *</label>
                        <input
                          name="codigo"
                          type="text"
                          value={formData.codigo}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, codigo: e.target.value }));
                            if (formErrors.codigo) setFormErrors((prev) => ({ ...prev, codigo: undefined }));
                          }}
                          placeholder="Código do produto (ex: 7891234567890)"
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                            formErrors.codigo ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {formErrors.codigo && (
                          <p className="text-sm text-red-600" role="alert">{formErrors.codigo}</p>
                        )}
                      </div>

                      {/* Nome do Produto */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto *</label>
                        <input
                          name="nome"
                          type="text"
                          value={formData.nome}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, nome: e.target.value }));
                            if (formErrors.nome) setFormErrors((prev) => ({ ...prev, nome: undefined }));
                          }}
                          placeholder="Descrição completa do produto"
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                            formErrors.nome ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {formErrors.nome && (
                          <p className="text-sm text-red-600" role="alert">{formErrors.nome}</p>
                        )}
                      </div>

                            {/* Categoria */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                          <select
                            name="categoriaId"
                            value={formData.categoriaId}
                            onChange={(e) => {
                              setFormData((prev) => ({ ...prev, categoriaId: e.target.value }));
                              if (formErrors.categoriaId) setFormErrors((prev) => ({ ...prev, categoriaId: undefined }));
                            }}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                              formErrors.categoriaId ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Selecionar categoria</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name || cat.nome}
                              </option>
                            ))}
                          </select>
                          {formErrors.categoriaId && (
                            <p className="text-sm text-red-600" role="alert">{formErrors.categoriaId}</p>
                          )}
                        </div>

                        {/* Preço de Venda */}
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Preço de Venda (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.preco}
                            onChange={(e) => setFormData((prev) => ({ ...prev, preco: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="0.00"
                          />
                          {formErrors.preco && (
                            <p className="text-sm text-red-600" role="alert">{formErrors.preco}</p>
                          )}
                        </div>

                        {/* Preço de Custo */}
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Preço de Custo (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.custo}
                            onChange={(e) => setFormData((prev) => ({ ...prev, custo: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Estoque */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Atual</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.estoque}
                            onChange={(e) => setFormData((prev) => ({ ...prev, estoque: parseInt(e.target.value) || 0 }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </div>

                        {/* Estoque Mínimo */}
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Estoque Mínimo</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.estoqueMinimo}
                            onChange={(e) => setFormData((prev) => ({ ...prev, estoqueMinimo: parseInt(e.target.value) || 0 }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                          {formErrors.estoque && (
                            <p className="text-sm text-red-600" role="alert">{formErrors.estoque}</p>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Status do Produto</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as ProductStatus }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option value={ProductStatus.ACTIVE}>Ativo</option>
                            <option value={ProductStatus.INACTIVE}>Inativo</option>
                            <option value={ProductStatus.DISCONTINUED}>Descontinuado</option>
                          </select>
                          {formErrors.estoque && (
                            <p className="text-sm text-red-600" role="alert">{formErrors.estoque}</p>
                          )}
                        </div>
                      </div>
                    </form>

                    <div className="mt-6 flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg hover:text-gray-900 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className={`px-4 py-3 bg-${mode === 'add' ? 'emerald-600' : 'blue-600'} text-white font-medium rounded-lg hover:${mode === 'add' ? 'emerald-700' : 'blue-700'} transition-colors`}
                      >
                        {mode === 'add' ? 'Adicionar Produto' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </div>
              </div>
            )}

            {/* Auto‑focus after modal operations */}
            <div className="hidden">
              <span className="sr-only">Focus management for modal</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}