import { readFile } from 'node:fs/promises';

export interface UploadPart {
  url: string;
  offset: number;
  length: number;
  part_number: number;
}

interface InitiateResponse {
  user_media: { uuid: string };
  upload_urls: UploadPart[];
}

export interface PublishOptions {
  apiBaseUrl: string;
  token: string;
  packagePath: string;
  authorName: string;
  communityCategories: Record<string, string[]>;
  hasNsfwContent: boolean;
  fetchImpl?: typeof fetch;
}

export interface PublishResult {
  hidden: boolean;
  uploadUuid: string;
  response: Record<string, unknown>;
}

async function apiJson<T>(
  fetchImpl: typeof fetch,
  token: string,
  url: string,
  body: unknown,
): Promise<T> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Hexium API request failed (${response.status} ${response.statusText}): ${detail}`,
    );
  }
  return (await response.json()) as T;
}

export async function publishToHexium(
  options: PublishOptions,
): Promise<PublishResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = options.apiBaseUrl.replace(/\/$/, '');
  const archive = await readFile(options.packagePath);
  const filename = options.packagePath.split(/[\\/]/).at(-1);
  if (!filename)
    throw new Error('The package path does not contain a filename.');

  const initiated = await apiJson<InitiateResponse>(
    fetchImpl,
    options.token,
    `${apiBase}/usermedia/initiate-upload/`,
    { filename, file_size_bytes: archive.length },
  );
  const uploadUuid = initiated.user_media?.uuid;
  if (!uploadUuid || !Array.isArray(initiated.upload_urls)) {
    throw new Error('Hexium initiate-upload returned an invalid response.');
  }

  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];
  try {
    for (const part of initiated.upload_urls) {
      const chunk = archive.subarray(part.offset, part.offset + part.length);
      if (chunk.length !== part.length)
        throw new Error(
          `Upload part ${part.part_number} exceeds the package size.`,
        );
      const response = await fetchImpl(part.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      });
      if (!response.ok)
        throw new Error(
          `Hexium upload part ${part.part_number} failed (${response.status}).`,
        );
      const etag = response.headers.get('etag');
      if (!etag)
        throw new Error(
          `Hexium upload part ${part.part_number} did not return an ETag.`,
        );
      completedParts.push({ ETag: etag, PartNumber: part.part_number });
    }

    await apiJson(
      fetchImpl,
      options.token,
      `${apiBase}/usermedia/${uploadUuid}/finish-upload/`,
      {
        parts: completedParts,
      },
    );
  } catch (error) {
    try {
      await apiJson(
        fetchImpl,
        options.token,
        `${apiBase}/usermedia/${uploadUuid}/abort-upload/`,
        {
          uuid: uploadUuid,
        },
      );
    } catch {
      // Preserve the original upload failure.
    }
    throw error;
  }

  const communities = Object.keys(options.communityCategories);
  const response = await apiJson<Record<string, unknown>>(
    fetchImpl,
    options.token,
    `${apiBase}/submission/submit/`,
    {
      author_name: options.authorName,
      categories: [],
      communities,
      has_nsfw_content: options.hasNsfwContent,
      upload_uuid: uploadUuid,
      community_categories: options.communityCategories,
    },
  );
  return { hidden: response.hidden === true, uploadUuid, response };
}
