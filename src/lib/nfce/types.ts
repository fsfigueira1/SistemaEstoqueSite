// Tipos da NFC-e (modelo 65, leiaute 4.00) — emissão on-line em São Paulo.

/** 1 = produção (vale de verdade), 2 = homologação (teste, sem valor fiscal). */
export type NfceAmbiente = 1 | 2

/** Regime: 1 = Simples Nacional, 2 = SN com excesso de sublimite, 3 = Regime normal, 4 = MEI. */
export type Crt = 1 | 2 | 3 | 4

/** CSOSN aceitos (Simples Nacional, venda a consumidor final). */
export type Csosn = "102" | "103" | "300" | "400" | "500"

/** Meios de pagamento da NFC-e (tPag). */
export type TPag = "01" | "03" | "04" | "05" | "10" | "11" | "12" | "13" | "15" | "16" | "17" | "18" | "19" | "90" | "99"

export interface NfceEmitente {
  cnpj: string
  ie: string
  razaoSocial: string
  nomeFantasia?: string
  crt: Crt
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  /** Código IBGE do município (7 dígitos). */
  cMun: string
  municipio: string
  uf: string
  cep: string
  fone?: string
}

export interface NfceResponsavelTecnico {
  cnpj: string
  contato: string
  email: string
  fone: string
}

export interface NfceItem {
  codigo: string
  /** GTIN/EAN; vazio vira "SEM GTIN". */
  ean?: string
  descricao: string
  ncm: string
  cest?: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  /** Desconto do próprio item (R$). */
  desconto?: number
  /** Origem da mercadoria (0 = nacional). */
  origem: number
  csosn: Csosn
}

export interface NfcePagamento {
  tPag: TPag
  valor: number
}

export interface NfceDadosVenda {
  ambiente: NfceAmbiente
  serie: number
  numero: number
  /** Data/hora da emissão. */
  emissao: Date
  emitente: NfceEmitente
  /** CPF ou CNPJ do consumidor (opcional). */
  consumidorDoc?: string
  consumidorNome?: string
  itens: NfceItem[]
  /** Desconto no total da venda (rateado entre os itens). */
  descontoTotal?: number
  /** Acréscimo no total (ex.: juros do cartão), rateado como "outras despesas". */
  acrescimoTotal?: number
  pagamentos: NfcePagamento[]
  /** Texto livre no rodapé da nota (infCpl). */
  informacoesComplementares?: string
  responsavelTecnico?: NfceResponsavelTecnico
  /** Nome e versão do sistema (verProc). */
  versaoSistema: string
  /** Código numérico da chave (8 dígitos). Se faltar, é sorteado. */
  codigoNumerico?: string
}

export interface NfceQrConfig {
  /** 2 = com CSC (padrão em SP hoje), 3 = sem CSC (NT 2025.001). */
  versao: 2 | 3
  idCsc?: string
  csc?: string
}
