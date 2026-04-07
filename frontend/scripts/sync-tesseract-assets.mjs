import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(SCRIPT_DIR, '..');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');
const TESSDATA_VERSION = '4.0.0_best_int';
const TESSERACT_LANGUAGE_PACKAGES = [
  { language: 'eng', packageName: '@tesseract.js-data/eng' },
  { language: 'chi_sim', packageName: '@tesseract.js-data/chi_sim' },
  { language: 'jpn', packageName: '@tesseract.js-data/jpn' },
  { language: 'kor', packageName: '@tesseract.js-data/kor' },
  { language: 'fra', packageName: '@tesseract.js-data/fra' },
  { language: 'deu', packageName: '@tesseract.js-data/deu' },
];

function resolvePackageDir(packageName, paths) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths });
  return path.dirname(packageJsonPath);
}

function buildAsset(from, toName = path.basename(from)) {
  return { from, toName };
}

const tesseractPackageDir = resolvePackageDir('tesseract.js', [FRONTEND_DIR]);
// `tesseract.js-core` is a transitive dependency, so resolve it from `tesseract.js`.
const tesseractCoreDir = resolvePackageDir('tesseract.js-core', [tesseractPackageDir]);

const COPY_GROUPS = [
  {
    to: path.join(PUBLIC_DIR, 'tesseract'),
    files: [buildAsset(path.join(tesseractPackageDir, 'dist', 'worker.min.js'))],
  },
  {
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
    ].map((file) => buildAsset(path.join(tesseractCoreDir, file))),
  },
  {
    to: path.join(PUBLIC_DIR, 'tessdata', TESSDATA_VERSION),
    files: [
      ...TESSERACT_LANGUAGE_PACKAGES.map(({ language, packageName }) =>
        buildAsset(
          path.join(resolvePackageDir(packageName, [FRONTEND_DIR]), TESSDATA_VERSION, `${language}.traineddata.gz`),
        ),
      ),
    ],
  },
];

async function copyGroup(group) {
  await mkdir(group.to, { recursive: true });
  await Promise.all(group.files.map((file) => cp(file.from, path.join(group.to, file.toName))));
}

await Promise.all(COPY_GROUPS.map(copyGroup));
