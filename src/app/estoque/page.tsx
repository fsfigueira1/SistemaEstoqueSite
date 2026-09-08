'use client';

import { useState, useEffect, useRef } from 'react';
import { ProductStatus } from '@/generated/prisma/client';
import type { ProductFormData } from '@/app/estoque/form/types';
import Layout from '@/components/Layout';

type Category = {
  id: string;
  nome: string;
};

type Product = {
  id: string;
  sku?: string | null;
  codigo?: string | null;
  name?: string | null;
  nome?: string | null;
  categoryId?: string | null;
  categoriaId?: string | null;
  salePrice?: number | string | null;
  preco?: number | string | null;
  costPrice?: number | string | null;
  custo?: number | string | null;
  stockQuantity?: number | null;
  estoque?: number | null;
  minStockLevel?: number | null;
  estoqueMinimo?: number | null;
  status?: ProductStatus | null;
};


// Helper to safely convert price values (number, string, or Prisma Decimal) to number
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

// Helper to format currency in Brazilian format
function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));
}

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [barcode, setBarcode] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<ProductFormData>({
    codigo: '',
    nome: '',
    categoriaId: null,
    preco: 0,
    custo: 0,
    estoque: 0,
    estoqueMinimo: 5,
    status: ProductStatus.ACTIVE
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [scannerStatus, setScannerStatus] = useState<'ready' | 'scanning' | 'added' | 'not-found'>('ready');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load products and categories on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [productsRes, categoriesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories')
        ]);

        const productsData = await productsRes.json();
        const categoriesData = await categoriesRes.json();

        if (productsData.success) {
          setProducts(productsData.data.products || []);
        }
        if (categoriesData.success) {
          setCategories(categoriesData.data.categories || []);
        }
      } catch (error) {
        console.error('Error loading products or categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Focus input on mount and after modal closes
  useEffect(() => {
    inputRef.current?.focus();
  }, [modalOpen]);

  // Handle barcode input from USB scanner
  useEffect(() => {
    if (barcode && !modalOpen) {
      // Clear existing timeout
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout to detect end of scanning
      timeoutRef.current = setTimeout(async () => {
        // Process the barcode when scanner finishes sending data
        try {
          const response = await fetch(`/api/products/barcode/${barcode}`);
          const result = await response.json();

          if (result.success && result.data) {
            const produto = result.data;
            setSelectedProduct(produto);
            setMode('edit');
            setFormData({
              codigo: produto.sku || produto.codigo || '',
              nome: produto.name || produto.nome || '',
              categoriaId: produto.categoryId || produto.categoriaId || null,
              preco: toNumber(produto.salePrice || produto.preco || 0),
              custo: toNumber(produto.costPrice || produto.custo || 0),
              estoque: toNumber(produto.stockQuantity || produto.estoque || 0),
              estoqueMinimo: toNumber(produto.minStockLevel || produto.estoqueMinimo || 5),
              status: produto.status || ProductStatus.ACTIVE
            });
            setModalOpen(true);
            setScannerStatus('added');
          } else {
            // If product not found, prepare to add new one
            setSelectedProduct(null);
            setMode('add');
            setFormData({
              codigo: barcode,
              nome: '',
              categoriaId: null,
              preco: 0,
              custo: 0,
              estoque: 0,
              estoqueMinimo: 5,
              status: ProductStatus.ACTIVE
            });
            setModalOpen(true);
            setScannerStatus('not-found');
          }
        } catch (err) {
          setScannerStatus('not-found');
          console.error('Barcode processing error:', err);
        } finally {
          setBarcode('');
          // Auto-reset scanner status after a brief moment
          setTimeout(() => {
            if (scannerStatus !== 'ready') {
              setScannerStatus('ready');
            }
          }, 1500);
        }
      }, 100);
    }

    // Cleanup function
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [barcode, modalOpen, scannerStatus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Prevent form submission
      e.preventDefault();
      // Código completo enviado pelo leitor
      return;
    }
    // Acumular caracteres para o código de barras
    setBarcode(prev => prev + e.key);
  };

  const handleBlur = () => {
    // Reset on blur to avoid accumulating incorrect data
    setBarcode('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log('Dados enviados:', formData);

    // VALIDAÇÃO COM MENSAGENS CLARAS (from prompt)
    const errors: string[] = [];
    if (!formData.codigo || formData.codigo.trim() === '') {
      errors.push('Código/SKU é obrigatório');
    }
    if (!formData.nome || formData.nome.trim() === '') {
      errors.push('Nome do produto é obrigatório');
    }
    if (formData.preco < 0) {
      errors.push('Preço não pode ser negativo');
    }
    if (formData.estoque < 0) {
      errors.push('Estoque não pode ser negativo');
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    try {
      const url = mode === 'add' ? '/api/products' : (selectedProduct ? `/api/products/${selectedProduct.id}` : '/api/products');
      const method = mode === 'add' ? 'POST' : 'PUT';

      // Prepare data with proper conversion - API expects Portuguese field names
      // GARANTIR QUE categoriaId SEJA ENVIADO COMO null EM VEZ DE STRING VAZIA
      const payload = {
        codigo: formData.codigo,
        nome: formData.nome,
        categoriaId: formData.categoriaId,
        preco: toNumber(formData.preco),
        custo: toNumber(formData.custo),
        estoque: toNumber(formData.estoque),
        estoqueMinimo: toNumber(formData.estoqueMinimo),
        status: formData.status
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('Resposta da API:', response);
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error?.message || result.error || 'Erro ao salvar produto');
        console.error('Erro detalhado:', result);
        return;
      }

      if (result.success) {
        setModalOpen(false);
        setFormData({
          codigo: '',
          nome: '',
          categoriaId: null,
          preco: 0,
          custo: 0,
          estoque: 0,
          estoqueMinimo: 5,
          status: ProductStatus.ACTIVE
        });
        setSelectedProduct(null);
        setMode('add');
        // Reload products
        const productsRes = await fetch('/api/products');
        const productsData = await productsRes.json();
        if (productsData.success) {
          setProducts(productsData.data.products || []);
        }
      } else {
        alert(result.error?.message || 'Erro ao salvar produto');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto');
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir ${product.name}?`)) return;

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        // Reload products
        const productsRes = await fetch('/api/products');
        const productsData = await productsRes.json();
        if (productsData.success) {
          setProducts(productsData.data.products || []);
        }
      } else {
        alert(result.error?.message || 'Erro ao excluir produto');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Erro ao excluir produto');
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData({
      codigo: '',
      nome: '',
      categoriaId: null,
      preco: 0,
      custo: 0,
      estoque: 0,
      estoqueMinimo: 5,
      status: ProductStatus.ACTIVE
    });
    setSelectedProduct(null);
    setMode('add');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Estoque</h1>
          <button
            onClick={() => {
              setMode('add');
              setSelectedProduct(null);
              setFormData({
                codigo: '',
                nome: '',
                categoriaId: null,
                preco: 0,
                custo: 0,
                estoque: 0,
                estoqueMinimo: 5,
                status: ProductStatus.ACTIVE
              });
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            Novo Produto
          </button>
        </div>

      {/* Barcode Scanner Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Leitor de Código de Barras (USB)</h2>
        <div className="flex items-center gap-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Aproxime o leitor de código de barras ou digite manualmente..."
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            scannerStatus === 'scanning' ? 'bg-blue-100 text-blue-800' :
            scannerStatus === 'added' ? 'bg-green-100 text-green-800' :
            scannerStatus === 'not-found' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {scannerStatus === 'scanning' ? 'Lendo...' :
            scannerStatus === 'added' ? 'Produto encontrado!' :
            scannerStatus === 'not-found' ? 'Produto não encontrado' :
            'Aguardando leitura'}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Mín.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm text-gray-900">{product.sku || product.codigo}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">{product.name || product.nome}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {categories.find((c: Category) => c.id === (product.categoryId || product.categoriaId))?.nome || 'Sem categoria'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{formatCurrency(product.salePrice ?? product.preco)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{formatCurrency(product.costPrice ?? product.custo)}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                    {product.stockQuantity !== undefined && product.stockQuantity !== null ? product.stockQuantity : (product.estoque || 0)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {product.minStockLevel !== undefined && product.minStockLevel !== null ? product.minStockLevel : (product.estoqueMinimo || 0)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      product.status === ProductStatus.ACTIVE ? 'bg-green-100 text-green-800' :
                      product.status === ProductStatus.INACTIVE ? 'bg-yellow-100 text-yellow-800' :
                      product.status === ProductStatus.DISCONTINUED ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {product.status === ProductStatus.ACTIVE ? 'Ativo' :
                       product.status === ProductStatus.INACTIVE ? 'Inativo' :
                       product.status === ProductStatus.DISCONTINUED ? 'Descontinuado' : 'Desconhecido'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setMode('edit');
                          setFormData({
                            codigo: product.sku || product.codigo || '',
                            nome: product.name || product.nome || '',
                            categoriaId: product.categoryId || product.categoriaId || null,
                            preco: toNumber(product.salePrice || product.preco || 0),
                            custo: toNumber(product.costPrice || product.custo || 0),
                            estoque: toNumber(product.stockQuantity !== undefined && product.stockQuantity !== null ? product.stockQuantity : (product.estoque || 0)),
                            estoqueMinimo: toNumber(product.minStockLevel !== undefined && product.minStockLevel !== null ? product.minStockLevel : (product.estoqueMinimo || 5)),
                            status: product.status || ProductStatus.ACTIVE
                          });
                          setModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Nenhum produto cadastrado. Clique no botão Novo Produto para começar.
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {mode === 'add' ? 'Novo Produto' : 'Editar Produto'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código / SKU</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={formData.categoriaId ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoriaId: e.target.value === '' ? null : e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((cat: Category) => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco}
                    onChange={(e) => setFormData(prev => ({ ...prev, preco: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.custo}
                    onChange={(e) => setFormData(prev => ({ ...prev, custo: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Atual</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.estoque}
                    onChange={(e) => setFormData(prev => ({ ...prev, estoque: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.estoqueMinimo}
                    onChange={(e) => setFormData(prev => ({ ...prev, estoqueMinimo: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProductStatus }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value={ProductStatus.ACTIVE}>Ativo</option>
                    <option value={ProductStatus.INACTIVE}>Inativo</option>
                    <option value={ProductStatus.DISCONTINUED}>Descontinuado</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {mode === 'add' ? 'Criar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}