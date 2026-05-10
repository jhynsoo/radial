# Issue Tracker Replacement Spec

## 1. Purpose

This document defines the issue-tracker contract required to replace the Linear usage described in
`SPEC.md` and the bundled repository workflow.

The goal is not to clone Linear. The goal is to expose the issue data and issue actions that
Symphony needs.

This spec is intentionally issue-centric:

- The primary object is the `Issue`.
- Non-issue objects such as `Project`, `Team`, `State`, `Comment`, and `Link` only matter insofar as
  they support issue scheduling or workflow execution.

## 2. Conformance Profiles

This spec defines two conformance profiles.

### 2.1 Core Scheduler Compatibility

A tracker is core-compatible when Symphony can:

- Poll candidate issues from a configured work scope.
- Refresh issue state by stable issue ID.
- Query terminal-state issues for workspace cleanup.
- Normalize tracker payloads into the `Issue` model expected by `SPEC.md`.
- Preserve scheduling semantics for active states, terminal states, blockers, priority, retries,
  and reconciliation.

Core compatibility is sufficient for the Symphony scheduler/orchestrator.

### 2.2 Full Workflow Compatibility

A tracker is full-workflow-compatible when it supports everything in Core Scheduler Compatibility,
plus the issue reads and issue mutations used by the bundled repository workflow:

- Read issue details, comments, and issue links/attachments.
- Create, update, and deactivate the single persistent workpad comment.
- Move an issue to a named state.
- Create follow-up issues.
- Create issue-to-issue relations such as `related` and `blocked_by`.
- Attach a PR URL or equivalent external link to an issue.

Full workflow compatibility is required if the goal is to replace Linear end to end for the bundled
agent workflow, not just for the scheduler.

### 2.3 Out Of Scope

A replacement tracker is not required to implement:

- Linear GraphQL.
- Linear-specific project, team, relation, label, or state schemas.
- Webhooks as the primary source of truth.
- Durable Symphony scheduler state.

## 3. Configuration Contract

The replacement tracker MUST support the tracker configuration concepts used by Symphony.

```yaml
tracker:
  kind: custom
  endpoint: https://tracker.example.com
  api_key: $TRACKER_API_KEY
  project_slug: project-key
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Closed
    - Canceled
    - Done
```

Fields:

- `tracker.kind`
  - Required.
  - Selects the tracker implementation.
- `tracker.endpoint`
  - Required when the tracker is reached through a network API.
  - The value is tracker-specific.
- `tracker.api_key`
  - Required when the tracker API requires authentication.
  - May be a literal token or an environment reference such as `$TRACKER_API_KEY`.
- `tracker.project_slug`
  - Required for dispatch.
  - Means "configured project, queue, repository, board, or work scope".
  - The tracker may name this concept differently internally, but Symphony must be able to scope all
    issue queries to this value.
- `tracker.active_states`
  - List of state names eligible for dispatch.
  - Default from `SPEC.md`: `["Todo", "In Progress"]`.
- `tracker.terminal_states`
  - List of state names that mark an issue as terminal for cleanup and stop decisions.
  - Default from `SPEC.md`: `["Closed", "Cancelled", "Canceled", "Duplicate", "Done"]`.

Optional extension:

- `tracker.assignee`
  - Optional scheduler filter.
  - If supported, it narrows candidate issues to a specific assignee or a special value such as
    `me`.

State name comparisons MUST be case-insensitive after trimming whitespace.

## 4. Primary Issue Model

Every required read operation MUST return issues normalized to the following shape.

```json
{
  "id": "tracker-issue-id",
  "identifier": "ABC-123",
  "title": "Implement cache invalidation",
  "description": "Markdown or plain text issue body",
  "priority": 1,
  "state": "Todo",
  "branch_name": "user/abc-123-cache-invalidation",
  "url": "https://tracker.example.com/issues/ABC-123",
  "labels": ["backend", "bug"],
  "blocked_by": [
    {
      "id": "tracker-issue-id-0",
      "identifier": "ABC-100",
      "state": "Done"
    }
  ],
  "created_at": "2026-05-09T00:00:00Z",
  "updated_at": "2026-05-09T00:10:00Z"
}
```

Required fields:

- `id`
  - Stable tracker-internal issue ID.
  - Used for claims, running state, retries, and refresh lookups.
- `identifier`
  - Stable human-readable issue key.
  - Used for workspace naming, logs, dashboard output, and prompt context.
- `title`
  - Used in prompt and run metadata.
- `state`
  - Current tracker state name.

Recommended fields:

- `description`
  - Used in prompt context.
- `priority`
  - Integer priority. Lower number means higher dispatch priority.
- `branch_name`
  - Tracker-provided branch metadata, if available.
- `url`
  - Human-visible issue URL.
- `labels`
  - Lowercase label names.
- `blocked_by`
  - List of blocker refs.
- `created_at`
  - Used for oldest-first tie-breaking.
- `updated_at`
  - Useful for observability and debugging.

Normalization requirements:

- `labels` MUST be a list of strings and SHOULD be lowercase.
- `blocked_by` MUST be a list. Use an empty list when there are no blockers.
- Each blocker SHOULD include `id`, `identifier`, and `state`.
- `priority` MUST be an integer or null.
- `created_at` and `updated_at` SHOULD be ISO-8601 timestamps or null.
- Unknown optional fields SHOULD be omitted or set to null rather than changing their type.

## 5. Non-Issue Data Used Indirectly

The tracker remains issue-centric, but full functionality requires a small set of issue-adjacent
data.

### 5.1 Work Scope

The tracker MUST support one configured work scope, exposed to Symphony as `project_slug` even if
the underlying product calls it a project, queue, board, repository, or workspace.

### 5.2 State Catalog

The tracker MUST support named issue states.

- Core scheduler compatibility only requires that issue records expose `state` and that Symphony can
  compare it against configured `active_states` and `terminal_states`.
- Full workflow compatibility additionally requires that an issue can be moved to a named state such
  as `In Progress` or `Human Review`.

The tracker MAY use internal state IDs, but Symphony-facing operations MUST accept state names.

### 5.3 Comments

Full workflow compatibility requires issue comments with at least:

- `id`
- `body`
- `resolved` or equivalent active/inactive marker
- `created_at` or equivalent ordering metadata
- `updated_at` when editable

This is required because the workflow keeps a single persistent `## Codex Workpad` comment and
updates it in place.

### 5.4 Links Or Attachments

Full workflow compatibility requires issue-linked external URLs or attachments so that the workflow
can discover and attach a PR URL.

Minimal link fields:

- `id`
- `url`
- `title` or `type` when available

### 5.5 Relations

The core issue model already includes `blocked_by`. Full workflow compatibility additionally needs a
way to create relations for follow-up issues.

At minimum, relation types SHOULD support:

- `related`
- `blocked_by`

### 5.6 Current User Identity

If `tracker.assignee: me` or an equivalent self-filter is supported, the tracker SHOULD expose a way
to resolve the current authenticated user identity.

## 6. Required Core Read Operations

The tracker MUST expose three read operations. Transport is intentionally unspecified: these may be
implemented through REST, GraphQL, RPC, local storage, or another protocol.

### 6.1 `FetchCandidateIssues`

Purpose:

- Return issues that may be considered for dispatch.

Input:

```json
{
  "project": "project-key",
  "active_states": ["Todo", "In Progress"]
}
```

Required semantics:

- Return only issues in the configured work scope.
- Return only issues whose current state is in `active_states`.
- Include enough issue fields for scheduling, prompt construction, and observability.
- Follow pagination internally or expose a cursor protocol that the Symphony integration can exhaust
  before returning the final result.
- Return an empty list when no issues match.
- Treat transport, authentication, authorization, and response-shape failures as operation errors.

The tracker does not need to pre-sort candidates. Symphony sorts candidates itself.

### 6.2 `FetchIssuesByStates`

Purpose:

- Return issues in specific states.
- Used by Symphony startup cleanup to remove stale workspaces for terminal issues.

Input:

```json
{
  "project": "project-key",
  "states": ["Closed", "Done"]
}
```

Required semantics:

- Return only issues in the configured work scope.
- Return only issues whose current state is in the supplied `states`.
- Return an empty list without failing when `states` is empty.
- Include `identifier` whenever available, because workspace cleanup is keyed from issue identifier.

### 6.3 `FetchIssuesByIds`

Purpose:

- Refresh state for running issues.
- Revalidate an issue before dispatch.
- Decide whether an agent should continue after a turn.

Input:

```json
{
  "ids": ["tracker-issue-id-1", "tracker-issue-id-2"]
}
```

Required semantics:

- Look up issues by stable tracker issue ID.
- Return an empty list without making a tracker request when `ids` is empty.
- Missing or no-longer-visible issues are not operation errors. Omit them from the result.
- Preserve requested ID order when practical.
- Include current `state` and `blocked_by` data, because Symphony uses this response for stop,
  continue, and dispatch decisions.

## 7. Scheduling Semantics Supported By Tracker Data

The tracker does not decide whether to run an agent. It supplies data so Symphony can apply the
rules from `SPEC.md`.

An issue is dispatch-eligible only when:

- It has `id`, `identifier`, `title`, and `state`.
- Its state is in `active_states`.
- Its state is not in `terminal_states`.
- It is not already running.
- It is not already claimed.
- Global concurrency slots are available.
- Per-state concurrency slots are available.
- If the issue state is `Todo`, no blocker is in a non-terminal state.

Blocker semantics:

- `blocked_by` represents issues that block the current issue.
- A `Todo` issue MUST NOT dispatch while any blocker has a state outside `terminal_states`.
- A blocker with unknown or missing state SHOULD be treated as non-terminal.
- For non-`Todo` active states, blocker handling is not required by `SPEC.md`.

Sorting semantics:

1. `priority` ascending. Values `1..4` are preferred; null or unknown sorts last.
2. `created_at` oldest first.
3. `identifier` lexicographic tie-breaker.

Terminal-state semantics:

- `FetchIssuesByStates` MUST make terminal issues discoverable for startup cleanup.
- During active reconciliation, a running issue that moves to a terminal state causes the run to
  stop and the workspace to become cleanup-eligible.
- A running issue that is no longer active and not terminal also causes the run to stop.

## 8. Full Workflow Compatibility Operations

This section is not required for core scheduler compatibility. It is required if the goal is full
replacement of Linear for the bundled repository workflow.

### 8.1 Issue Detail Read

The workflow needs a way to read an issue in more detail than the core scheduler model.

Recommended operation:

- `GetIssue(issue_id)` or equivalent

Recommended response data:

- Core issue fields from Section 4
- Full issue body/description
- Current state
- Existing comments
- Existing links/attachments
- Existing relations
- Work-scope reference if helpful for follow-up issue creation

### 8.2 Comment Lifecycle

The workflow expects one persistent workpad comment per issue.

Required capabilities for full workflow compatibility:

- `ListIssueComments(issue_id, include_resolved=false)`
- `CreateIssueComment(issue_id, body)`
- `UpdateIssueComment(comment_id, body)`
- `DeactivateIssueComment(comment_id)`

`DeactivateIssueComment` may be implemented as delete, archive, resolve, or another tracker-native
operation, as long as the deactivated comment no longer appears as an active candidate for workpad
reuse.

### 8.3 State Transition

Required capability:

- `UpdateIssueState(issue_id, state_name)`

Required semantics:

- Accept a stable issue ID and a target state name.
- Perform any tracker-specific state ID lookup internally if necessary.
- Return structured success or error output.

### 8.4 Link Or Attachment Management

The workflow needs to discover an existing PR link and attach one if missing.

Required capabilities for full workflow compatibility:

- `ListIssueLinks(issue_id)`
- `AttachIssueLink(issue_id, url, title_or_type)`

The tracker MAY model these as attachments, external links, references, or another native concept.

### 8.5 Follow-Up Issue Creation

When out-of-scope work is discovered, the workflow creates a separate issue instead of expanding the
current one.

Required capabilities for full workflow compatibility:

- `CreateIssue(project, title, description, state_name, labels)`
- `CreateIssueRelation(source_issue_id, relation_type, target_issue_id)`

Required semantics:

- The new issue can be created in the same configured project/work scope.
- The new issue can be placed into a named state such as `Backlog`.
- The tracker can express a `related` relation to the current issue.
- The tracker can express a `blocked_by` relation when the follow-up depends on the current issue.

### 8.6 Optional Self-Identity Lookup

If the tracker supports assignee self-filtering or self-authored comment filtering, it SHOULD expose:

- `GetCurrentUser()` or equivalent

### 8.7 Workflow-Specific State Expectations

The bundled repository workflow currently expects named states such as:

- `Backlog`
- `Todo`
- `In Progress`
- `Human Review`
- `Merging`
- `Rework`
- `Done`

These are repository workflow expectations, not global Symphony requirements. A replacement tracker
is compatible when it can represent these states directly or when the repository workflow is updated
to use equivalent tracker-native names.

## 9. Error Contract

Tracker operation failures SHOULD map to stable error categories.

Recommended core categories:

- `missing_tracker_api_key`
- `missing_tracker_project_slug`
- `tracker_auth_failed`
- `tracker_forbidden`
- `tracker_not_found`
- `tracker_rate_limited`
- `tracker_request_failed`
- `tracker_bad_status`
- `tracker_decode_error`
- `tracker_unknown_payload`
- `tracker_missing_page_cursor`

Recommended workflow-parity categories:

- `tracker_comment_not_found`
- `tracker_comment_update_failed`
- `tracker_comment_deactivate_failed`
- `tracker_invalid_state_transition`
- `tracker_state_not_found`
- `tracker_link_attach_failed`
- `tracker_issue_create_failed`
- `tracker_relation_create_failed`

Required Symphony behavior:

- Candidate fetch failure: log and skip dispatch for the current tick.
- Running-state refresh failure: log and keep active workers running until the next tick.
- Startup terminal cleanup failure: log a warning and continue startup.
- Dispatch revalidation failure: skip that dispatch attempt.
- Post-turn issue refresh failure: fail the worker attempt so it can be retried by the orchestrator.

## 10. Optional REST Transport Shape

This section gives one possible HTTP API shape for an external tracker service. It is not required
if the tracker is implemented through another transport.

Core scheduler endpoints:

- `POST /api/v1/issues/search`
  - Implements `FetchCandidateIssues` and `FetchIssuesByStates`
- `POST /api/v1/issues/lookup`
  - Implements `FetchIssuesByIds`

Full workflow endpoints:

- `GET /api/v1/issues/{issue_id}`
  - Returns detailed issue data including comments and links when practical
- `GET /api/v1/issues/{issue_id}/comments`
- `POST /api/v1/issues/{issue_id}/comments`
- `PATCH /api/v1/comments/{comment_id}`
- `DELETE /api/v1/comments/{comment_id}`
  - Or an equivalent archive/resolve endpoint
- `PATCH /api/v1/issues/{issue_id}`
  - Supports named state updates
- `GET /api/v1/issues/{issue_id}/links`
- `POST /api/v1/issues/{issue_id}/links`
- `POST /api/v1/issues`
- `POST /api/v1/issues/{issue_id}/relations`
- `GET /api/v1/users/me`
  - Optional

Transport notes:

- Authentication SHOULD use tracker-specific auth, commonly `Authorization: Bearer <token>`.
- Authentication failures MUST be distinguishable from missing issue results.
- A tracker may use GraphQL, REST, or another transport as long as it preserves the contract
  described above.

## 11. Conformance Tests

A replacement tracker SHOULD be tested against these behaviors.

Core scheduler tests:

- Candidate search filters by work scope.
- Candidate search filters by active states.
- Empty state list returns an empty result.
- Empty ID list returns an empty result.
- ID lookup returns current state for visible issues.
- ID lookup omits missing or invisible issues.
- Terminal-state lookup returns terminal issues for workspace cleanup.
- Labels normalize to lowercase strings.
- Priority is integer or null.
- Timestamps are ISO-8601 or null.
- Todo issue with a non-terminal blocker is not dispatchable by Symphony.
- Todo issue with only terminal blockers is dispatchable when other conditions pass.
- Candidate fetch failure does not stop running workers.
- Running-state refresh failure keeps active workers running until the next tick.
- Terminal transition during reconciliation stops the active run and allows workspace cleanup.

Full workflow tests:

- Issue detail read includes body, comments, and links or exposes equivalent read APIs.
- Existing active workpad comment can be found by marker text and reused.
- Workpad comment can be updated in place by comment ID.
- Workpad comment can be deactivated so it is not reused after rework reset.
- Issue state can be moved by state name.
- Existing issue links/attachments can be listed.
- A PR URL can be attached to an issue.
- A follow-up issue can be created in the same work scope.
- A follow-up issue can be linked as `related`.
- A follow-up issue can be linked as `blocked_by` when required.
