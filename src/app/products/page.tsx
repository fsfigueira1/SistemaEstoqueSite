import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableRow, 
  TableCell, 
  TableHead
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

export default function ProductsPage() {
  // Mock data - in a real app, this would come from the database via Prisma
  const products = [
    { id: 1, name: "Caneta Esferográfica Azul", sku: "CAN-AZ-001", stock: 150, price: 1.50 },
    { id: 2, name: "Caderno Universitário 100 folhas", sku: "CAD-UNI-100", stock: 89, price: 12.90 },
    { id: 3, name: "Lápis HB #2", sku: "LAP-HB-001", stock: 300, price: 0.50 },
    { id: 4, name: "Borracha branca", sku: "BOR-BRA-001", stock: 200, price: 0.80 },
    { id: 5, name: "Régua plástica 30cm", sku: "REG-PLA-030", stock: 120, price: 2.50 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button variant="outline">
          New Product
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="w-20">SKU</TableHead>
              <TableHead className="w-16">Stock</TableHead>
              <TableHead className="w-20">Price</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.id}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell className="text-center">{product.stock}</TableCell>
                <TableCell className="text-right">R$ {product.price.toFixed(2)}</TableCell>
                <TableCell className="flex justify-center space-x-2">
                  <Button variant="ghost" size="icon" aria-label="Edit">
                    {/* Edit icon would go here */}
                  </Button>
                  <Button variant="destructive" size="icon" aria-label="Delete">
                    {/* Delete icon would go here */}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right">
                <Pagination>
                  <PaginationNext />
                  <PaginationPrevious />
                </Pagination>
              </TableCell>
              <TableCell colSpan={1} className="text-center">
                <Button variant="outline">Export</Button>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
