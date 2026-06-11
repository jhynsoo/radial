# Coverage Improvement Design

Date: 2026-06-01

## Context

Radial has meaningful test coverage on both applications, but the coverage
workflow is uneven. The API already exposes a Jest coverage command and reports
about 92% line coverage. The strongest remaining API opportunity is not raw
percentage gain, but regression coverage around Prisma repository branches that
handle missing records, foreign key failures, transaction early returns, and
write-then-reload behavior.

The web app has Vitest unit tests and Playwright browser flows, but it cannot
produce a coverage report because the Vitest coverage provider is not installed
and no `test:cov` script exists.

## Goals

- Improve API regression coverage for high-risk repository and service
  boundary behavior.
- Add web coverage instrumentation so Vitest can produce text, HTML, and lcov
  reports.
- Add a consistent local command path for API and web coverage.
- Prepare CI to run coverage commands as observational checks.
- Keep coverage thresholds out of this milestone.
- Avoid tests that exist only to raise bootstrap or module wiring percentages.

## Non-Goals

- Do not add coverage thresholds or fail CI based on coverage percentage.
- Do not chase `app.module.ts`, `main.ts`, or `prisma.module.ts` coverage unless
  a real behavior risk emerges.
- Do not redesign the API or web test architecture.
- Do not add browser-level code coverage for Playwright in this milestone.
- Do not require a live database for repository unit tests.

## API Test Strategy

The API work should focus on `prisma-issue.repository.ts` first. It owns the
highest-value uncovered behavior because it maps service requests to Prisma
transactions and converts persistence failures into tracker-level outcomes.

Priority cases:

- Issue state updates rethrow unexpected Prisma errors instead of hiding them as
  missing records.
- Comment creation returns `null` for missing issue records and rethrows
  unrelated transaction failures.
- Link attachment and relation creation return `null` for foreign key failures.
- Comment update and deactivation return `null` when the target comment is not
  found inside the transaction.
- Created issues, comments, links, and relations are reloaded or mapped through
  the same response shape expected by the service layer.

`issue-tracker.service.ts` remains a secondary target. Add service tests only
when a repository outcome needs verification at the API behavior boundary, such
as `null` repository writes becoming not-found tracker errors or malformed
payloads preserving their existing error categories.

`in-memory-issue.repository.ts` is lower priority because the runtime path is
Prisma-backed. Add tests there only if a service-level scenario depends on the
in-memory implementation contract.

## Web Coverage Strategy

The first web milestone is measurement, not aggressive percentage improvement.
Install the Vitest V8 coverage provider and add a `test:cov` script that runs
Vitest once with coverage enabled.

Coverage output should include:

- text summary for local and CI logs
- lcov for future CI artifact or coverage service integration
- HTML report for local inspection

After measurement is available, use the first report to decide targeted web
tests. Initial candidates are:

- `app/issues/actions.ts`, because server actions mediate issue creation and
  mutations.
- `components/issues/issue-kanban-board.tsx`, because e2e covers behavior but
  unit coverage is likely sparse.
- `components/issues/board-toolbar.tsx`, because it controls project and filter
  workflow entry points.

Do not add web tests blindly before the first coverage report unless the missing
behavior is already obvious from the report or current tests.

## Command And CI Workflow

Keep the existing API command:

```sh
DATABASE_URL='postgresql://user:password@localhost:5432/radial_test?schema=public' pnpm --filter api test:cov
```

Add a web command:

```sh
pnpm --filter web test:cov
```

Add a root command only if it improves developer ergonomics without conflicting
with the existing Turborepo task model. A root `test:cov` script may run both app
coverage commands in sequence.

CI should run coverage as an observational check. The job should fail on test
failures or broken coverage generation, but not on coverage percentages. This
keeps the baseline visible while avoiding premature threshold churn.

## Error Handling

Coverage commands should fail loudly when tests fail or coverage providers are
missing. API coverage commands still need a valid-looking `DATABASE_URL` because
the API scripts run Prisma generation before Jest. The coverage plan should not
touch local secret files or require `.env.local` edits.

## Testing

Verification for this milestone:

- `DATABASE_URL='postgresql://user:password@localhost:5432/radial_test?schema=public' pnpm --filter api test:cov`
- `pnpm --filter web test:cov`
- `pnpm --filter web test:e2e`

If CI workflow files or root scripts change, also run:

- `pnpm lint`
- `pnpm typecheck`

The expected outcome is a measurable web coverage baseline, retained API
coverage above the current practical baseline, and additional API tests that
exercise real persistence-boundary failure modes.

## Rollout Notes

This milestone should be split into implementation steps:

1. Add API repository or service tests for the highest-risk uncovered branches.
2. Add web coverage provider configuration and `test:cov`.
3. Add or adjust root and CI coverage commands for observational reporting.
4. Run coverage and use the first web report to decide whether a small follow-up
   web test should be included immediately.

Thresholds can be introduced later after the team accepts the first measured web
baseline.
