import Sidebar from "@/components/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 border-r">
        <Sidebar />
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
