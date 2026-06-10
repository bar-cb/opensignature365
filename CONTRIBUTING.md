# Contributing

Thanks for considering a contribution!

## Dev setup

```bash
npm install
npm run dev          # API on :4070 + Vite UI on :4071
npm test             # vitest run
npm run typecheck    # tsc --noEmit
```

## Project layout

- `src/core/` — types, validation, sanitizer, template engine, storage, deploy orchestration
- `src/microsoft/` — Graph and Exchange Online integration
- `src/server/` — Express HTTP API
- `src/cli/` — yargs CLI
- `web/` — Vite + React + Tailwind admin UI
- `scripts/powershell/` — pwsh scripts called by EXO integration
- `data/templates/` — built-in HTML signature templates (seed via `node scripts/seed-templates.mjs`)
- `tests/` — vitest tests

## Conventions

- TypeScript strict, ESM, target ES2022.
- All HTML rendered to email **must** go through `sanitizeEmailHtml()`.
- All filesystem paths join via `safeJoin()` to prevent traversal.
- No new direct calls to `pwsh` outside `src/microsoft/exchange.ts`.
- Any PowerShell script that mutates Exchange **must** enforce the rule-name prefix safety check.
- Production deploys must require either the env flag or explicit confirmation argument.

## Tests

Add tests under `tests/` mirroring the source path. Run `npm test`. Snapshot tests are fine for rendered HTML provided they are deterministic.

## Templates

Add a new template by dropping a `template.json` + `template.html` (+ optional `template.txt`) into `data/templates/<id>/`. The bundled templates use only email-safe HTML (tables, inline styles, no JS, no external CSS, no remote fonts). See [tests/templates-fixture.test.ts](tests/templates-fixture.test.ts) for the contract.

## License

By contributing, you agree your contributions are licensed under AGPL-3.0-or-later.
