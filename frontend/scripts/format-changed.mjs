import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const frontendRoot = process.cwd();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim();
    throw new Error(message || `Command failed: ${command} ${args.join(' ')}`);
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePath(filePath) {
  const relativePath = filePath.startsWith('frontend/')
    ? filePath.slice('frontend/'.length)
    : filePath;

  const absolutePath = resolve(frontendRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }

  return relativePath;
}

const changedFiles = new Set([
  ...run('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', '.']),
  ...run('git', ['ls-files', '--others', '--exclude-standard', '--', '.']),
]);

const prettierTargets = [...changedFiles]
  .map(normalizePath)
  .filter((filePath) => filePath !== null);

if (prettierTargets.length === 0) {
  console.log('No changed frontend files to format.');
  process.exit(0);
}

const result = spawnSync(
  'npx',
  ['prettier', '--write', '--ignore-unknown', ...prettierTargets],
  {
    cwd: frontendRoot,
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
