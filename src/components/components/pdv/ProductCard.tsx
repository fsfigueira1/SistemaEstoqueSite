import { Badge } from '@/components/components/ui/badge';
import { Button } from '@/components/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/components/ui/card';
import { Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    salePrice: number;
    stockQuantity: number;
    minStockLevel: number;
    status: string;
    category?: {
      name: string;
      icon?: string;
      color?: string;
    };
  };
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  initialQuantity?: number;
}

export function ProductCard({
  product,
  onQuantityChange,
  onRemove,
  initialQuantity = 1
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isLowStock, setIsLowStock] = useState(false);

  // Check if product is low stock
  useEffect(() => {
    setIsLowStock(product.stockQuantity <= product.minStockLevel);
  }, [product.stockQuantity, product.minStockLevel]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 0) {
      setQuantity(value);
      onQuantityChange(product.id, value);
    }
  };

  const handleIncrement = () => {
    setQuantity((prev) => {
      const newVal = prev + 1;
      onQuantityChange(product.id, newVal);
      return newVal;
    });
  };

  const handleDecrement = () => {
    if (quantity > 0) {
      setQuantity((prev) => {
        const newVal = prev - 1;
        onQuantityChange(product.id, newVal);
        return newVal;
      });
    }
  };

  const handleRemove = () => {
    onRemove(product.id);
    setQuantity(0);
  };

  // Format price as Brazilian currency
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-semibold line-clamp-2">
            {product.name}
          </CardTitle>
          {product.barcode && (
            <div className="text-xs text-muted-foreground mt-1">
              Código: {product.barcode}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {product.category && (
              <Badge
                variant="secondary"
                className={`bg-${product.category.color ?? 'gray-200'}/20 text-${product.category.color ?? 'gray-800'} hover:bg-${product.category.color ?? 'gray-200'}/30`}
              >
                {product.category.name}
              </Badge>
            )}
            <Badge
              variant={isLowStock ? 'destructive' : 'secondary'}
              className={isLowStock
                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
            >
              {isLowStock ? 'ESTOQUE BAIXO' : `Estoque: ${product.stockQuantity}`}
            </Badge>
          </div>
        </div>

        <div className="flex items-end space-x-2 mt-4 sm:mt-0">
          <Badge
            variant={product.status === 'ACTIVE' ? 'secondary' : 'destructive'}
          >
            {product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="mt-4 space-y-4">
        <div className="flex items-baseline gap-4">
          <span className="text-3xl font-bold">
            {formatPrice(product.salePrice)}
          </span>
          <span className="text-xs text-muted-foreground ml-3">
            unidade
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium flex items-center">
            Quantidade:
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecrement}
              disabled={quantity <= 0}
              className="p-1"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <input
              type="number"
              value={quantity}
              min="0"
              onChange={handleQuantityChange}
              className="w-20 text-center border rounded px-2 py-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleIncrement}
              className="p-1"
            >
              <Edit className="h-3 w-3" />
            </Button>
          </div>
          <span className="ml-auto text-sm font-semibold">
            {formatPrice(product.salePrice * quantity)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between items-center pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="text-sm"
        >
          Remover
        </Button>
      </CardFooter>
    </Card>
  );
}