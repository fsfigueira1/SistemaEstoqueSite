// Assinatura digital XMLDSig no padrão da SEFAZ: RSA-SHA1, C14N (inclusiva),
// transformações enveloped-signature + c14n, KeyInfo com o certificado.
import { SignedXml } from "xml-crypto"
import { certBase64, type CertificadoA1 } from "@/lib/nfce/certificate"

const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"

/**
 * Assina o elemento `tag` (ex.: "infNFe", "infEvento") e coloca a <Signature>
 * logo depois dele, dentro do elemento pai (`parent`, ex.: "NFe", "evento").
 */
export function assinarXml(xml: string, tag: string, parent: string, cert: CertificadoA1): string {
  const sig = new SignedXml({
    privateKey: cert.keyPem,
    publicCert: cert.certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: C14N,
    getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64(cert.certPem)}</X509Certificate></X509Data>`,
  })
  sig.addReference({
    xpath: `//*[local-name(.)='${tag}']`,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  })
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${parent}']`, action: "append" },
  })
  return sig.getSignedXml()
}

/** Confere a assinatura (usado nos testes e para checar um XML salvo). */
export function assinaturaValida(xml: string, cert: CertificadoA1): boolean {
  const sig = new SignedXml({ publicCert: cert.certPem })
  const m = xml.match(/<Signature[\s\S]*?<\/Signature>/)
  if (!m) return false
  sig.loadSignature(m[0])
  return sig.checkSignature(xml)
}
