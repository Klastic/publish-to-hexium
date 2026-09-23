import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { inspectPackage } from '../src/package.js';

async function fixture(manifest: object): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'hexium-action-'));
  const path = join(directory, 'package.zip');
  const zip = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'README.md': strToU8('# Test'),
    'icon.png': strToU8('icon'),
  });
  await writeFile(path, zip);
  return path;
}

describe('inspectPackage', () => {
  it('reads a valid package manifest', async () => {
    const path = await fixture({
      name: 'Example',
      version_number: '1.2.3',
      description: 'Example',
      website_url: '',
      dependencies: [],
    });
    await expect(inspectPackage(path)).resolves.toMatchObject({
      name: 'Example',
      version_number: '1.2.3',
    });
  });

  it('rejects a non-semantic version', async () => {
    const path = await fixture({
      name: 'Example',
      version_number: 'latest',
      description: 'Example',
      website_url: '',
      dependencies: [],
    });
    await expect(inspectPackage(path)).rejects.toThrow('semantic version');
  });
});
