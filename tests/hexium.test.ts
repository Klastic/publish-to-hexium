import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { publishToHexium } from '../src/hexium.js';

describe('publishToHexium', () => {
  it('uploads parts, finishes, and submits the package', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hexium-upload-'));
    const packagePath = join(directory, 'example.zip');
    await writeFile(packagePath, Buffer.from('abcdef'));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user_media: { uuid: 'upload-1' },
            upload_urls: [
              {
                url: 'https://upload.test/1',
                offset: 0,
                length: 6,
                part_number: 1,
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response('', { status: 200, headers: { ETag: 'etag-1' } }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ hidden: true }), { status: 200 }),
      );

    const result = await publishToHexium({
      apiBaseUrl: 'https://hexium.test/api/experimental',
      token: 'secret',
      packagePath,
      authorName: 'ExampleTeam',
      communityCategories: { valheim: ['Mods'] },
      hasNsfwContent: false,
      fetchImpl,
    });
    expect(result).toMatchObject({ hidden: true, uploadUuid: 'upload-1' });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const submit = JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body));
    expect(submit).toMatchObject({
      author_name: 'ExampleTeam',
      communities: ['valheim'],
      upload_uuid: 'upload-1',
    });
  });

  it('aborts the multipart upload after a part failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hexium-upload-'));
    const packagePath = join(directory, 'example.zip');
    await writeFile(packagePath, Buffer.from('abcdef'));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user_media: { uuid: 'upload-2' },
            upload_urls: [
              {
                url: 'https://upload.test/1',
                offset: 0,
                length: 6,
                part_number: 1,
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('failed', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await expect(
      publishToHexium({
        apiBaseUrl: 'https://hexium.test/api/experimental',
        token: 'secret',
        packagePath,
        authorName: 'ExampleTeam',
        communityCategories: { valheim: ['Mods'] },
        hasNsfwContent: false,
        fetchImpl,
      }),
    ).rejects.toThrow('upload part 1 failed');
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(
      'https://hexium.test/api/experimental/usermedia/upload-2/abort-upload/',
    );
  });
});
