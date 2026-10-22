import { NextResponse } from "next/server"
import { ContactService } from "@/services/contactService"
import { friendlyError } from "@/lib/friendlyError"
import { isJsonRequest } from "@/lib/requireJson"

type Ctx = { params: Promise<{ id: string }> }

const notFound = (error: unknown) => (error as { code?: string })?.code === "P2025"

// PATCH /api/contacts/[id] { ativo } — saiu / voltou a receber novidades
export async function PATCH(request: Request, { params }: Ctx) {
  if (!isJsonRequest(request)) return NextResponse.json({ success: false, error: "Envie JSON" }, { status: 415 })
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.ativo !== "boolean") return NextResponse.json({ success: false, error: "Informe ativo" }, { status: 400 })
    await ContactService.setStatus((await params).id, body.ativo)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (notFound(error)) return NextResponse.json({ success: false, error: "Contato não encontrado" }, { status: 404 })
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}

// DELETE /api/contacts/[id]
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await ContactService.remove((await params).id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (notFound(error)) return NextResponse.json({ success: false, error: "Contato não encontrado" }, { status: 404 })
    return NextResponse.json({ success: false, error: friendlyError(error).message }, { status: 500 })
  }
}
