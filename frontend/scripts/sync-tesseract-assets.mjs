import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(SCRIPT_DIR, '..');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');

const COPY_GROUPS = [
  {
    from: path.join(FRONTEND_DIR, 'node_modules', 'tesseract.js', 'dist'),
    to: path.join(PUBLIC_DIR, 'tesseract'),
    files: ['worker.min.js'],
  },
  {
    from: path.join(FRONTEND_DIR, 'node_modules', 'tesseract.js-core'),
    to: path.join(PUBLIC_DIR, 'tesseract', 'core'),
    files: [
      'tesseract-core.wasm.js',
      'tesseract-core.wasm',
      'tesseract-core-lstm.wasm.js',
      'tesseract-core-lstm.wasm',
      'tesseract-core-simd.wasm.js',
      'tesseract-core-simd.wasm',
      'tesseract-core-simd-lstm.wasm.js',
      'tesseract-core-simd-lstm.wasm',
      'tesseract-core-relaxedsimd.wasm.js',
      'tesseract-core-relaxedsimd.wasm',
      'tesseract-core-relaxedsimd-lstm.wasm.js',
      'tesseract-core-relaxedsimd-lstm.wasm',
    ],
  },
  {
    from: path.join(FRONTEND_DIR, 'node_modules', '@tesseract.js-data'),
    to: path.join(PUBLIC_DIR, 'tessdata', '4.0.0_best_int'),
    files: [
      'eng/4.0.0_best_int/eng.traineddata.gz',
      'chi_sim/4.0.0_best_int/chi_sim.traineddata.gz',
      'jpn/4.0.0_best_int/jpn.traineddata.gz',
      'kor/4.0.0_best_int/kor.traineddata.gz',
      'fra/4.0.0_best_int/fra.traineddata.gz',
      'deu/4.0.0_best_int/deu.traineddata.gz',
    ],
  },
];

async function copyGroup(group) {
  await mkdir(group.to, { recursive: true });
  await Promise.all(
    group.files.map((file) => cp(path.join(group.from, file), path.join(group.to, path.basename(file)))),
  );
}

await Promise.all(COPY_GROUPS.map(copyGroup));
