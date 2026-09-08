import { redirect } from "next/navigation"

export default function RootPage() {
  // This is a POS system without authentication - redirect directly to PDV
  return redirect("/pdv")
}