'use client';

// Leitura da foto da lista escolar no próprio computador (grátis, sem
// internet): tesseract.js com os arquivos em /public/ocr (ver
// scripts/copy-ocr-assets.cjs). Letra de mão sai pior — aí vale a IA.

/** Reduz a foto (mais rápido e leve) e devolve um JPEG. */
export async function shrinkImage(file: Blob, maxSide = 1800, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Não consegui abrir a foto'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Não consegui ler a foto'));
    r.readAsDataURL(b);
  });
}

/** Lê o texto da foto no computador. `onProgress` recebe de 0 a 1. */
export async function readImageLocally(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker, OEM } = await import('tesseract.js');
  const worker = await createWorker('por', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(await shrinkImage(file, 2200, 0.92));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
