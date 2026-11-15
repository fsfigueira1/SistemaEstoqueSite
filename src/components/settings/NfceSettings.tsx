'use client';

// Configurações → Nota fiscal (NFC-e). Só o dono. Dados da empresa, ambiente,
// CSC, padrões fiscais e o certificado digital A1 (fica só neste computador).

import { useEffect, useState } from 'react';
import { FileCheck2, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { Field, Section } from '@/components/settings/PriceSearchSettings';
import { errorText } from '@/lib/friendlyError';
import { CONFIG_PADRAO, type NfceConfig } from '@/lib/nfce/config';

type Cert = { titular: string; cnpj: string; validoAte: string; vencido: boolean } | null;
type Data = { config: NfceConfig; cscSet: boolean; certificado: Cert; certificadoErro: string; faltando: string[] };

const inp = 'w-full rounded-lg border border-border bg-card px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-60';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) throw new Error(errorText(d, 'Não deu certo'));
  return d.data as T;
}

export default function NfceSettings() {
  const [data, setData] = useState<Data | null>(null);
  const [cfg, setCfg] = useState<NfceConfig>(CONFIG_PADRAO);
  const [csc, setCsc] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'cert' | 'status'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');

  const aplicar = (d: Data) => {
    setData(d);
    setCfg(d.config);
  };

  useEffect(() => {
    api<Data>('/api/nfce/config')
      .then(aplicar)
      .catch((e) => setMsg({ ok: false, text: errorText(e, 'Não consegui ler a configuração fiscal') }));
  }, []);

  const set = <K extends keyof NfceConfig>(k: K, v: NfceConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setE = <K extends keyof NfceConfig['emitente']>(k: K, v: NfceConfig['emitente'][K]) =>
    setCfg((c) => ({ ...c, emitente: { ...c.emitente, [k]: v } }));

  const run = async (kind: typeof busy, fn: () => Promise<void>) => {
    setBusy(kind);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e, 'Não deu certo') });
    } finally {
      setBusy('');
    }
  };

  const salvar = () =>
    run('save', async () => {
      const d = await api<Data>('/api/nfce/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg, csc: csc || undefined }),
      });
      aplicar(d);
      setCsc('');
      setMsg({ ok: true, text: d.faltando.length ? 'Salvo. Ainda falta preencher alguns campos.' : 'Salvo.' });
    });

  const enviarCert = () =>
    run('cert', async () => {
      if (!file) throw new Error('Escolha o arquivo .pfx do certificado');
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('senha', senha);
      await api('/api/nfce/certificado', { method: 'POST', body: fd });
      setSenha('');
      setFile(null);
      aplicar(await api<Data>('/api/nfce/config'));
      setMsg({ ok: true, text: 'Certificado guardado neste computador.' });
    });

  const testar = () =>
    run('status', async () => {
      const s = await api<{ cStat: number; motivo: string; ambiente: number }>('/api/nfce/status');
      setMsg({
        ok: s.cStat === 107,
        text: `SEFAZ-SP (${s.ambiente === 1 ? 'produção' : 'homologação'}): ${s.cStat} - ${s.motivo}`,
      });
    });

  const e = cfg.emitente;
  const cert = data?.certificado;

  return (
    <Section
      icon={<FileCheck2 className="h-5 w-5" />}
      title="Nota fiscal (NFC-e)"
      desc="Nota Fiscal de Consumidor Eletrônica — SEFAZ-SP (substitui o SAT desde 2026)"
    >
      {!data ? (
        <p className="text-sm text-muted-foreground">{msg?.text ?? 'Carregando…'}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-foreground/90 sm:col-span-3">
              <input type="checkbox" checked={cfg.enabled} onChange={(ev) => set('enabled', ev.target.checked)} className="h-4 w-4 rounded border-border" />
              Emitir NFC-e pelo PDV
            </label>
            <Field label="Ambiente">
              <select value={cfg.ambiente} onChange={(ev) => set('ambiente', Number(ev.target.value) === 1 ? 1 : 2)} className={inp}>
                <option value={2}>Homologação (teste, sem valor fiscal)</option>
                <option value={1}>Produção (nota de verdade)</option>
              </select>
            </Field>
            <Field label="Série">
              <input type="number" min={0} max={999} value={cfg.serie} onChange={(ev) => set('serie', Number(ev.target.value) || 0)} className={inp} />
            </Field>
            <Field label="Começar no número">
              <input type="number" min={1} value={cfg.numeroInicial} onChange={(ev) => set('numeroInicial', Number(ev.target.value) || 1)} className={inp} />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Empresa (como está na SEFAZ)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CNPJ">
                <input value={e.cnpj} onChange={(ev) => setE('cnpj', ev.target.value)} className={inp} inputMode="numeric" />
              </Field>
              <Field label="Inscrição estadual">
                <input value={e.ie} onChange={(ev) => setE('ie', ev.target.value)} className={inp} inputMode="numeric" />
              </Field>
              <Field label="Razão social">
                <input value={e.razaoSocial} onChange={(ev) => setE('razaoSocial', ev.target.value)} className={inp} maxLength={60} />
              </Field>
              <Field label="Nome fantasia">
                <input value={e.nomeFantasia ?? ''} onChange={(ev) => setE('nomeFantasia', ev.target.value)} className={inp} maxLength={60} />
              </Field>
              <Field label="Regime tributário">
                <select value={e.crt} onChange={(ev) => setE('crt', Number(ev.target.value) as NfceConfig['emitente']['crt'])} className={inp}>
                  <option value={1}>Simples Nacional</option>
                  <option value={4}>MEI</option>
                </select>
              </Field>
              <Field label="Telefone">
                <input value={e.fone ?? ''} onChange={(ev) => setE('fone', ev.target.value)} className={inp} inputMode="tel" />
              </Field>
              <Field label="Rua">
                <input value={e.logradouro} onChange={(ev) => setE('logradouro', ev.target.value)} className={inp} maxLength={60} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Número">
                  <input value={e.numero} onChange={(ev) => setE('numero', ev.target.value)} className={inp} />
                </Field>
                <Field label="Complemento">
                  <input value={e.complemento ?? ''} onChange={(ev) => setE('complemento', ev.target.value)} className={inp} />
                </Field>
              </div>
              <Field label="Bairro">
                <input value={e.bairro} onChange={(ev) => setE('bairro', ev.target.value)} className={inp} />
              </Field>
              <Field label="CEP">
                <input value={e.cep} onChange={(ev) => setE('cep', ev.target.value)} className={inp} inputMode="numeric" />
              </Field>
              <Field label="Município">
                <input value={e.municipio} onChange={(ev) => setE('municipio', ev.target.value)} className={inp} />
              </Field>
              <Field label="Código IBGE do município (7 dígitos)">
                <input value={e.cMun} onChange={(ev) => setE('cMun', ev.target.value)} className={inp} inputMode="numeric" placeholder="ex.: 3550308 (São Paulo)" />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">QR Code e CSC</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Versão do QR Code">
                <select value={cfg.qrVersao} onChange={(ev) => set('qrVersao', Number(ev.target.value) === 3 ? 3 : 2)} className={inp}>
                  <option value={2}>Versão 2 (com CSC)</option>
                  <option value={3}>Versão 3 (sem CSC)</option>
                </select>
              </Field>
              <Field label="ID do token (CSC)">
                <input value={cfg.idCsc} onChange={(ev) => set('idCsc', ev.target.value)} className={inp} placeholder="ex.: 000001" />
              </Field>
              <Field label="CSC">
                <input
                  type="password"
                  value={csc}
                  onChange={(ev) => setCsc(ev.target.value)}
                  className={inp}
                  autoComplete="off"
                  placeholder={data.cscSet ? 'guardado — deixe vazio para manter' : 'código do site da SEFAZ'}
                />
              </Field>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              O CSC é gerado no site da SEFAZ-SP (um para homologação e outro para produção). Se a SEFAZ recusar a versão 3, use a versão 2.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Padrões dos produtos</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="CFOP">
                <input value={cfg.cfopPadrao} onChange={(ev) => set('cfopPadrao', ev.target.value)} className={inp} />
              </Field>
              <Field label="CSOSN">
                <select value={cfg.csosnPadrao} onChange={(ev) => set('csosnPadrao', ev.target.value as NfceConfig['csosnPadrao'])} className={inp}>
                  <option value="102">102 — sem crédito</option>
                  <option value="103">103 — isento (faixa)</option>
                  <option value="300">300 — imune</option>
                  <option value="400">400 — não tributada</option>
                  <option value="500">500 — ICMS por ST</option>
                </select>
              </Field>
              <Field label="NCM padrão">
                <input value={cfg.ncmPadrao} onChange={(ev) => set('ncmPadrao', ev.target.value)} className={inp} placeholder="8 dígitos" />
              </Field>
              <Field label="Origem">
                <select value={cfg.origemPadrao} onChange={(ev) => set('origemPadrao', Number(ev.target.value))} className={inp}>
                  <option value={0}>0 — Nacional</option>
                  <option value={1}>1 — Importação direta</option>
                  <option value={2}>2 — Importada (mercado interno)</option>
                </select>
              </Field>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              O NCM do cadastro do produto vale mais que o padrão. Confirme CFOP, CSOSN e NCM com a contabilidade.
            </p>
            <div className="mt-3">
              <Field label="Informações no rodapé da nota (ex.: tributos aproximados — Lei 12.741)">
                <textarea
                  value={cfg.informacoesComplementares}
                  onChange={(ev) => set('informacoesComplementares', ev.target.value)}
                  rows={2}
                  className={inp}
                  maxLength={500}
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Responsável técnico pelo sistema</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="CNPJ">
                <input value={cfg.respTecCnpj} onChange={(ev) => set('respTecCnpj', ev.target.value)} className={inp} />
              </Field>
              <Field label="Contato">
                <input value={cfg.respTecContato} onChange={(ev) => set('respTecContato', ev.target.value)} className={inp} />
              </Field>
              <Field label="E-mail">
                <input value={cfg.respTecEmail} onChange={(ev) => set('respTecEmail', ev.target.value)} className={inp} />
              </Field>
              <Field label="Telefone">
                <input value={cfg.respTecFone} onChange={(ev) => set('respTecFone', ev.target.value)} className={inp} />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={salvar}
              disabled={busy !== ''}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nota fiscal
            </button>
            <button
              onClick={testar}
              disabled={busy !== '' || !cert}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
            >
              {busy === 'status' && <Loader2 className="h-4 w-4 animate-spin" />} Testar conexão com a SEFAZ
            </button>
          </div>

          {data.faltando.length > 0 && <p className="text-sm text-danger">Falta: {data.faltando.join(' · ')}</p>}

          <div className="rounded-xl border border-border p-4">
            <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4" /> Certificado digital A1 deste computador
            </p>
            {cert ? (
              <p className={`mb-3 text-sm ${cert.vencido ? 'text-danger' : 'text-muted-foreground'}`}>
                {cert.titular} — válido até {new Date(cert.validoAte).toLocaleDateString('pt-BR')}
                {cert.vencido ? ' (VENCIDO)' : ''}
              </p>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">
                {data.certificadoErro || 'Nenhum certificado. Cada computador que emite nota precisa do arquivo .pfx.'}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Arquivo (.pfx ou .p12)">
                <input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} className={inp} />
              </Field>
              <Field label="Senha do certificado">
                <input type="password" value={senha} onChange={(ev) => setSenha(ev.target.value)} className={inp} autoComplete="new-password" />
              </Field>
              <button
                onClick={enviarCert}
                disabled={busy !== '' || !file}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                {busy === 'cert' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Guardar
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              O certificado e a senha ficam só neste computador (protegidos), nunca no banco da internet. Os XMLs autorizados são salvos em
              Documentos\Lacolaria Notas Fiscais\ano\mês — guarde por 5 anos.
            </p>
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-primary' : 'text-danger'}`}>{msg.text}</p>}
        </div>
      )}
    </Section>
  );
}
