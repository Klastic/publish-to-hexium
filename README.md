# Publish to Hexium

A GitHub Action that publishes a Thunderstore-compatible package ZIP directly to the Hexium API. It performs Hexium's multipart upload flow, submits the package, and reports whether Hexium accepted it as hidden.

This Action does not use TCLI and does not publish to Thunderstore.

## Quick start

Create a Hexium API token for the team that owns the package. In GitHub, open **Settings**, **Secrets and variables**, **Actions**, then create a repository secret named `HEXIUM_AUTH_TOKEN`.

```yaml
name: Publish to Hexium

on:
  workflow_dispatch:
    inputs:
      publish:
        description: Publish the validated package
        required: true
        type: boolean
        default: false

jobs:
  publish:
    if: inputs.publish
    runs-on: ubuntu-latest
    environment: hexium-production
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/build-package.sh
      - id: hexium
        uses: Klastic/publish-to-hexium@v1
        with:
          token: ${{ secrets.HEXIUM_AUTH_TOKEN }}
          package: dist/ExampleTeam-ExampleMod-1.2.3.zip
          author-name: ExampleTeam
          community-categories: |
            {
              "valheim": ["Client & Server", "Mods", "Open Source", "Valheim 1.0"]
            }
      - run: echo "Hexium accepted the package; hidden=${{ steps.hexium.outputs.hidden }}"
```

Use a protected GitHub environment for production publishing. Keep validation and package construction in your repository; this Action accepts a completed ZIP.

## Package requirements

The ZIP must contain `manifest.json`, `README.md`, and `icon.png` at its root. The manifest must provide `name`, `version_number`, `description`, `website_url`, and `dependencies`. `version_number` must be a semantic version.

## Inputs

| Input                  | Required | Description                                                                                               |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `token`                | Yes      | Hexium team API token stored in a GitHub Actions secret.                                                  |
| `package`              | Yes      | Path to the completed package ZIP.                                                                        |
| `author-name`          | Yes      | Hexium team or author namespace.                                                                          |
| `community-categories` | Yes      | JSON object mapping community identifiers to category arrays. The communities are inferred from its keys. |
| `has-nsfw-content`     | No       | Sets Hexium's NSFW flag. Defaults to `false`.                                                             |
| `api-base-url`         | No       | Hexium API base. Defaults to `https://hexium.gg/api/experimental`.                                        |

## Outputs

| Output            | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `hidden`          | `true` when Hexium reports the submitted package as hidden. |
| `upload-uuid`     | Hexium's user-media upload identifier.                      |
| `package-name`    | Name read from the packaged manifest.                       |
| `package-version` | Version read from the packaged manifest.                    |

An accepted submission is not the same as a publicly visible package. The Action reports Hexium's `hidden` result and does not scrape the public website or wait for listing propagation.

## API flow

The Action calls Hexium's experimental API directly:

1. Initiates a user-media upload.
2. Uploads every byte range to its presigned URL.
3. Completes the multipart upload with the returned ETags.
4. Aborts the upload when a part or completion request fails.
5. Submits the uploaded ZIP with the configured author, communities, categories, and content flag.

Because the endpoint is currently under `/api/experimental`, pin this Action to a major release and review release notes before upgrading.

## Versioning and development

The project uses Conventional Commits and Semantic Versioning. CI runs formatting, linting, type checking, tests, coverage, and a reproducible bundle check. Merges to `main` are released by semantic-release, and the corresponding major tag is updated for Action consumers.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [SECURITY.md](SECURITY.md) for private vulnerability reporting.
