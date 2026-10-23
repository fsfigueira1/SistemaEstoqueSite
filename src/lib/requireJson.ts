// Só JSON: formulário de outro site (CSRF) não consegue mandar
// application/json sem preflight, que o servidor não libera. Compara o tipo
// principal (antes do ";") — "text/plain; charset=application/json" passa
// sem preflight e não pode ser aceito.
export function isJsonRequest(request: Request): boolean {
  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  return mime === "application/json"
}
