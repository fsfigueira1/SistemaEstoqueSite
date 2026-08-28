import { ProductStatus } from '@/generated/prisma';

export type ProductFormData = {
  codigo: string;
  nome: string;
  categoriaId: string | null;
  preco: number;
  custo: number;
  estoque: number;
  estoqueMinimo: number;
  status: ProductStatus;
};