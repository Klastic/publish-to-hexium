# Contributing

1. Create a focused branch from `main`.
2. Install dependencies with `npm ci`.
3. Run `npm run check` before opening a pull request.
4. Use Conventional Commits such as `feat: add upload retries` or `fix: abort failed multipart uploads`.

`feat` creates a minor release, `fix` creates a patch release, and a breaking change creates a major release. Pull requests must include tests for behavior changes. Commit the generated `dist` bundle whenever source changes affect the Action.
