import Link from "next/link"
import {
  Menu,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Settings
} from "lucide-react"

type NavItem = {
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
}

export default function Sidebar() {
  const navItems: NavItem[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/products", icon: ShoppingCart, label: "Products" },
    { href: "/orders", icon: Users, label: "Orders" },
    { href: "/customers", icon: Users, label: "Customers" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ]

  return (
    <aside className="flex flex-col h-full px-4 py-6 bg-white">
      <div className="flex items-center space-x-3 mb-8">
        <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Menu className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Laçolaria ERP</h2>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium
                ${window.location.pathname === item.href ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:bg-muted hover:text-foreground"}`}
            >
              <Icon />
              <span className="ml-3">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
