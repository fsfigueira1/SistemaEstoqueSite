import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Laçolaria ERP Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-4xl font-bold">1,234</p>
          </CardContent>
        </Card>
        
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Today&#39;s Sales</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-4xl font-bold">R$ 5,678.90</p>
          </CardContent>
        </Card>
        
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-4xl font-bold">12</p>
          </CardContent>
        </Card>
        
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-4xl font-bold">8</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <Button variant="outline" className="w-full">
          View All Reports
        </Button>
      </div>
    </div>
  )
}
