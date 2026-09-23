import * as core from '@actions/core';
import { publishToHexium } from './hexium.js';
import { inspectPackage } from './package.js';

function parseCategories(input: string): Record<string, string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('community-categories must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('community-categories must be a JSON object.');
  for (const [community, categories] of Object.entries(parsed)) {
    if (
      !community ||
      !Array.isArray(categories) ||
      categories.length === 0 ||
      !categories.every((v) => typeof v === 'string' && v.length > 0)
    ) {
      throw new Error(
        `community-categories entry ${community || '(empty)'} must be a non-empty array of strings.`,
      );
    }
  }
  return parsed as Record<string, string[]>;
}

export async function run(): Promise<void> {
  try {
    const token = core.getInput('token', { required: true });
    core.setSecret(token);
    const packagePath = core.getInput('package', { required: true });
    const manifest = await inspectPackage(packagePath);
    core.info(
      `Publishing ${manifest.name} ${manifest.version_number} to Hexium.`,
    );
    const result = await publishToHexium({
      token,
      packagePath,
      authorName: core.getInput('author-name', { required: true }),
      communityCategories: parseCategories(
        core.getInput('community-categories', { required: true }),
      ),
      hasNsfwContent: core.getBooleanInput('has-nsfw-content'),
      apiBaseUrl: core.getInput('api-base-url', { required: true }),
    });
    core.setOutput('hidden', String(result.hidden));
    core.setOutput('upload-uuid', result.uploadUuid);
    core.setOutput('package-name', manifest.name);
    core.setOutput('package-version', manifest.version_number);
    core.notice(
      `Hexium accepted ${manifest.name} ${manifest.version_number}; hidden=${result.hidden}.`,
    );
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void run();
