import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

const platform = process.argv[2];

const masterIconPath = path.join(repoRoot, 'icons', 'macos', '1024x1024.png');

const pngTargets = [
  {
    directory: path.join(repoRoot, 'icons', 'linux', 'icons'),
    sizes: [16, 32, 48, 64, 128, 256, 512],
  },
  {
    directory: path.join(repoRoot, 'icons', 'windows'),
    sizes: [16, 32, 48, 64, 128, 256],
  },
  {
    directory: path.join(repoRoot, 'icons', 'macos'),
    sizes: [16, 32, 64, 128, 256, 512, 1024],
  },
];

const directPngTargets = [
  { size: 1024, outputPath: path.join(repoRoot, 'icons', 'icon.png') },
  { size: 1024, outputPath: path.join(repoRoot, 'build', 'appicon.png') },
  {
    size: 1024,
    outputPath: path.join(frontendRoot, 'src', 'assets', 'branding', 'app-icon.png'),
  },
  {
    size: 1024,
    outputPath: path.join(frontendRoot, 'src', 'assets', 'branding', 'app-logo.png'),
  },
  {
    size: 80,
    outputPath: path.join(frontendRoot, 'src', 'assets', 'branding', 'app-logo-80.png'),
  },
];

const icoVariants = [
  { size: 16, outputPath: path.join(repoRoot, 'icons', 'windows', '16x16.png') },
  { size: 32, outputPath: path.join(repoRoot, 'icons', 'windows', '32x32.png') },
  { size: 48, outputPath: path.join(repoRoot, 'icons', 'windows', '48x48.png') },
  { size: 256, outputPath: path.join(repoRoot, 'icons', 'windows', '256x256.png') },
];

const icnsIconsetEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

async function main() {
  await validateMasterIcon();

  for (const target of pngTargets) {
    await mkdir(target.directory, { recursive: true });

    for (const size of target.sizes) {
      const outputPath = path.join(target.directory, `${size}x${size}.png`);
      await writePngVariant(size, outputPath);
    }
  }

  for (const target of directPngTargets) {
    await writePngVariant(target.size, target.outputPath);
  }

  await writeIcoFile(
    icoVariants.map((variant) => variant.outputPath),
    path.join(repoRoot, 'icons', 'windows', 'icon.ico'),
  );
  await writeIcoFile(
    icoVariants.map((variant) => variant.outputPath),
    path.join(frontendRoot, 'src', 'favicon.ico'),
  );

  await writeIcnsFile();

  if (platform?.startsWith('windows/')) {
    await unlink(path.join(repoRoot, 'build', 'windows', 'icon.ico')).catch((error) => {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    });
  }
}

async function validateMasterIcon() {
  let fileInfo;

  try {
    fileInfo = await stat(masterIconPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing icon master file at ${masterIconPath}: ${message}`);
  }

  if (!fileInfo.isFile()) {
    throw new Error(`Icon master path is not a file: ${masterIconPath}`);
  }

  const metadata = await sharp(masterIconPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read icon dimensions from ${masterIconPath}`);
  }

  if (metadata.width !== metadata.height) {
    throw new Error(
      `Icon master file must be square, got ${metadata.width}x${metadata.height}: ${masterIconPath}`,
    );
  }
}

async function writePngVariant(size, outputPath) {
  if (path.resolve(outputPath) === path.resolve(masterIconPath)) {
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  await sharp(masterIconPath)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toFile(outputPath);
}

async function writeIcoFile(sourcePngPaths, outputPath) {
  const pngBuffers = await Promise.all(
    sourcePngPaths.map((filePath) => readFile(filePath)),
  );
  const icoBuffer = await pngToIco(pngBuffers);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, icoBuffer);
}

async function writeIcnsFile() {
  const iconutilPath = await findIconutil();
  if (!iconutilPath) {
    console.warn(
      `Skipping icon.icns generation because 'iconutil' is not available. PNG and ICO outputs were still regenerated.`,
    );
    return;
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), 'azure-blob-logviewer-iconset-'));
  const iconsetDir = path.join(tempRoot, 'app.iconset');

  await mkdir(iconsetDir, { recursive: true });

  try {
    for (const [fileName, size] of icnsIconsetEntries) {
      await writePngVariant(size, path.join(iconsetDir, fileName));
    }

    await mkdir(path.join(repoRoot, 'icons', 'macos'), { recursive: true });
    await execFileAsync(iconutilPath, [
      '-c',
      'icns',
      iconsetDir,
      '-o',
      path.join(repoRoot, 'icons', 'macos', 'icon.icns'),
    ]);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

async function findIconutil() {
  try {
    const { stdout } = await execFileAsync('/usr/bin/xcrun', ['-f', 'iconutil']);
    const iconutilPath = stdout.trim();

    return iconutilPath || null;
  } catch {
    return null;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate icons: ${message}`);
  process.exit(1);
});
