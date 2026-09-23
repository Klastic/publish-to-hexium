import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

export interface PackageManifest {
  name: string;
  version_number: string;
  description: string;
  website_url: string;
  dependencies: string[];
}

export async function inspectPackage(path: string): Promise<PackageManifest> {
  await access(path);
  const zip = unzipSync(await readFile(path));
  for (const required of ['manifest.json', 'README.md', 'icon.png']) {
    if (!zip[required])
      throw new Error(`Package ZIP is missing ${required} at its root.`);
  }
  const entry = zip['manifest.json'];
  if (!entry) throw new Error('Package ZIP is missing manifest.json.');
  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder().decode(entry));
  } catch {
    throw new Error('Package manifest.json is not valid JSON.');
  }
  if (!manifest || typeof manifest !== 'object')
    throw new Error('Package manifest.json must contain an object.');
  const value = manifest as Record<string, unknown>;
  for (const field of [
    'name',
    'version_number',
    'description',
    'website_url',
  ]) {
    if (typeof value[field] !== 'string')
      throw new Error(`Package manifest field ${field} must be a string.`);
  }
  if (
    !Array.isArray(value.dependencies) ||
    !value.dependencies.every((item) => typeof item === 'string')
  ) {
    throw new Error(
      'Package manifest field dependencies must be an array of strings.',
    );
  }
  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version_number as string)
  ) {
    throw new Error(
      'Package manifest version_number must be a semantic version.',
    );
  }
  return value as unknown as PackageManifest;
}
