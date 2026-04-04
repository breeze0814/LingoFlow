import { createWorker } from 'tesseract.js';
import { resolveTesseractLanguages } from './ocrRuntimeLanguage';

const TESSERACT_WORKER_PATH = '/tesseract/worker.min.js';
const TESSERACT_CORE_PATH = '/tesseract/core';
const TESSERACT_LANG_PATH = '/tessdata/4.0.0_best_int';
const TESSERACT_LSTM_ONLY = 1;

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<TesseractWorker> | null = null;
let activeLanguageKey = '';

function buildLanguageKey(languages: string[]) {
  return languages.join('+');
}

async function createConfiguredWorker(languages: string[]) {
  return createWorker(buildLanguageKey(languages), TESSERACT_LSTM_ONLY, {
    corePath: TESSERACT_CORE_PATH,
    langPath: TESSERACT_LANG_PATH,
    workerPath: TESSERACT_WORKER_PATH,
  });
}

async function ensureWorker(languages: string[]) {
  const nextLanguageKey = buildLanguageKey(languages);
  if (!workerPromise) {
    activeLanguageKey = nextLanguageKey;
    workerPromise = createConfiguredWorker(languages);
    return workerPromise;
  }

  const worker = await workerPromise;
  if (activeLanguageKey === nextLanguageKey) {
    return worker;
  }

  await worker.reinitialize(nextLanguageKey, TESSERACT_LSTM_ONLY);
  activeLanguageKey = nextLanguageKey;
  return worker;
}

export async function recognizeImageWithTesseract(
  imageDataUrl: string,
  sourceLangHint?: string | null,
) {
  const languages = resolveTesseractLanguages(sourceLangHint);
  const worker = await ensureWorker(languages);
  const result = await worker.recognize(imageDataUrl);
  return result.data.text.trim();
}

export async function terminateTesseractWorker() {
  if (!workerPromise) {
    return;
  }

  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
  activeLanguageKey = '';
}
