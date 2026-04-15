import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const platform = process.argv[2];

if (!platform) {
  console.error('Missing build platform argument. Expected GOOS/GOARCH, e.g. windows/amd64.');
  process.exit(1);
}

const sourceIconPath = path.join(repoRoot, 'icons', 'icon.png');
const buildDirPath = path.join(repoRoot, 'build');
const buildAppIconPath = path.join(buildDirPath, 'appicon.png');
const windowsIconPath = path.join(buildDirPath, 'windows', 'icon.ico');

try {
  await mkdir(buildDirPath, { recursive: true });
  await copyFile(sourceIconPath, buildAppIconPath);

  if (platform.startsWith('windows/')) {
    await rm(windowsIconPath, { force: true });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to sync Wails icons: ${message}`);
  process.exit(1);
}
