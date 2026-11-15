// Leitura do certificado digital A1 (.pfx/.p12) da empresa.
import forge from "node-forge"
import { onlyDigits } from "@/lib/nfce/format"

export interface CertificadoA1 {
  /** Chave privada em PEM (assina o XML e autentica na SEFAZ). */
  keyPem: string
  /** Certificado em PEM. */
  certPem: string
  /** Nome do titular (CN). */
  titular: string
  /** CNPJ que consta no certificado (vazio se não achar). */
  cnpj: string
  validoDe: Date
  validoAte: Date
}

/** Lê o .pfx com a senha. Erro claro se a senha estiver errada. */
export function lerCertificado(pfx: Buffer, senha: string): CertificadoA1 {
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")))
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha)
  } catch {
    throw new Error("Não consegui abrir o certificado: confira a senha e se o arquivo é .pfx ou .p12")
  }

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ]
  const key = keyBags.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined
  if (!key) throw new Error("O certificado não tem chave privada (precisa ser o A1 com a chave)")

  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c))
  // o certificado da empresa é o que tem a mesma chave pública da chave privada
  const cert =
    certs.find((c) => {
      const pub = c.publicKey as forge.pki.rsa.PublicKey
      return pub.n && pub.n.equals(key.n)
    }) ?? certs[0]
  if (!cert) throw new Error("O arquivo não tem certificado")

  const titular = String(cert.subject.getField("CN")?.value ?? "")
  // e-CNPJ: "RAZAO SOCIAL:12345678000199"
  const cnpj = onlyDigits(titular.split(":").pop()).length === 14 ? onlyDigits(titular.split(":").pop()) : ""

  return {
    keyPem: forge.pki.privateKeyToPem(key),
    certPem: forge.pki.certificateToPem(cert),
    titular,
    cnpj,
    validoDe: cert.validity.notBefore,
    validoAte: cert.validity.notAfter,
  }
}

/** Corpo do certificado (base64, sem cabeçalho) — vai no <X509Certificate>. */
export const certBase64 = (certPem: string) =>
  certPem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "")
