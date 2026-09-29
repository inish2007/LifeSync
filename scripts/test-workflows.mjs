import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'scratch', 'workflow-test-build');
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['node_modules/typescript/bin/tsc', '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2020', '--esModuleInterop', '--skipLibCheck', '--types', 'node', '--outDir', output,
  'scratch/test-workflows.ts', 'scratch/test-focus-mode.ts', 'scratch/test-backplanner.ts', 'scratch/test-reminders.ts']);
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}\n');
for (const test of ['test-workflows', 'test-focus-mode', 'test-backplanner', 'test-reminders']) run([path.join(output, 'scratch', `${test}.js`)]);
