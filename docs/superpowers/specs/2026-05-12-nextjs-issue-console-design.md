# Next.js Issue Console Design

Date: 2026-05-12

## Context

Radial implements an automation-friendly issue tracker with a Nest API and a
Next.js web app in the same pnpm/Turborepo workspace. The API currently exposes
issue search, lookup, detail, creation, state updates, comments, links,
relations, and current-user lookup under `/api/v1`.

The first web app milestone is an operator/developer console built on top of
that API. It is not a marketing site and not a broad project-management UI. It
should make issue workflow state visible immediately and support practical issue
operations.

## Goals

- Show a Kanban board as the first screen.
- Scope the board by a project slug that can be entered directly and selected
  from browser-stored recent projects.
- Support issue creation and issue updates, including state changes, comments,
  links, and relations.
- Keep API credentials out of the browser by routing calls through Next.js
  server code.
- Provide stable issue detail URLs for deeper work and sharing.
- Keep the implementation close to the current shadcn/Tailwind-style web app
  and shared `@workspace/ui` package.

## Non-Goals

- Do not add a server-side project catalog in this milestone.
- Do not implement broad project-management features such as epics, sprints,
  roadmaps, or team administration.
- Do not expose `TRACKER_API_KEY` to client-side code.
- Do not make terminal or canceled states primary board columns.

## Product Structure

### Home Board

The home route `/` shows the Kanban board immediately. The default columns are:

- `Backlog`
- `Todo`
- `In Progress`
- `Human Review`
- `Merging`
- `Rework`
- `Done`

The top toolbar contains:

- `ProjectScopePicker`: direct project slug input plus recent-project choices.
- Board search/filter controls for narrowing visible cards.
- A "new issue" action that opens `/issues/new`.

Each issue card shows:

- `identifier`
- `title`
- `priority`
- `labels`
- blocker presence from `blocked_by`
- `updated_at` when useful for scanning

Cards navigate to `/issues/[issueId]` when clicked. Dragging a card to another
column updates the issue state through the API. Terminal and canceled states
such as `Closed`, `Canceled`, `Cancelled`, and `Duplicate` remain reachable
through search/filter flows but are not default board columns.

### Issue Detail

The route `/issues/[issueId]` is the full operation surface for an issue. It
shows the issue title, identifier, current state, description, priority, labels,
branch name, URL, blockers, links, relations, and comments.

The detail page supports:

- Explicit state changes through a state selector.
- Comment creation, update, and deactivation.
- Link attachment.
- Relation creation.
- Refreshing issue data after mutations.

The detail page should use tabs or clearly separated sections for:

- `Comments`
- `Links`
- `Relations`

On wide screens, metadata can sit beside the primary content. On mobile, the
metadata should stack below the primary content.

### New Issue

The route `/issues/new` creates an issue. The current project scope from the
home board is used as the default `project` value.

Supported fields:

- `project`
- `title`
- `description`
- `state`
- `priority`
- `labels`
- `assignee`
- `blocked_by`

## Data Flow

The web app should contain a server-only tracker API client under `apps/web`.
That client reads:

- `TRACKER_API_BASE_URL`
- `TRACKER_API_KEY`

Browser components must call Next.js route handlers or server actions instead
of calling the Nest API directly. The server-side client adds the bearer token
when `TRACKER_API_KEY` is configured.

### Home Board Loading

Use `POST /api/v1/issues/search`.

Request shape:

```json
{
  "project": "project-slug",
  "states": [
    "Backlog",
    "Todo",
    "In Progress",
    "Human Review",
    "Merging",
    "Rework",
    "Done"
  ]
}
```

The response issues are grouped by `state` to render columns.

### Detail Loading

Use `GET /api/v1/issues/:issueId` for the initial detail page payload.

The initial detail response is the source for:

- issue summary fields
- comments
- links
- relations

The UI may refresh comments and links with:

- `GET /api/v1/issues/:issueId/comments?include_resolved=true`
- `GET /api/v1/issues/:issueId/links`

### Mutations

Use the existing API endpoints:

- Create issue: `POST /api/v1/issues`
- Update issue state: `PATCH /api/v1/issues/:issueId`
- Create comment: `POST /api/v1/issues/:issueId/comments`
- Update comment: `PATCH /api/v1/comments/:commentId`
- Deactivate comment: `DELETE /api/v1/comments/:commentId`
- Attach link: `POST /api/v1/issues/:issueId/links`
- Create relation: `POST /api/v1/issues/:issueId/relations`
- Current user lookup: `GET /api/v1/users/me`

## Components

Recommended component boundaries:

- `IssueBoardPage`
- `ProjectScopePicker`
- `BoardToolbar`
- `IssueKanbanBoard`
- `IssueColumn`
- `IssueCard`
- `IssueDetailPage`
- `IssueHeader`
- `IssueMetadata`
- `IssueComments`
- `IssueLinks`
- `IssueRelations`
- `IssueStateSelect`
- `NewIssuePage`
- `IssueForm`

These components should keep presentation and server data access separate. The
server API client should not be imported from client components.

## State Management

Server-fetched data is the source of truth. Pages load their initial data on the
server where practical, then user mutations call server-side handlers and
refresh the affected route or board data.

Recent projects are stored in browser `localStorage`. The current project slug
is selected by the user and used for board searches and new issue defaults.

Board drag-and-drop may use optimistic updates. If the API call fails, the card
returns to its previous column and the UI displays the API error category and
message.

Detail-page forms should prefer explicit submit and success/error states over
optimistic updates. This is safer for comments, links, and relations where the
result contains generated IDs and timestamps.

## Error Handling

API errors should preserve the backend `error.category` value. The UI should
display both the stable category and human-readable message when useful for an
operator.

Important error cases:

- Authentication failure
- Missing or invalid project slug
- Issue not found
- Invalid state transition
- Invalid link URL
- Comment update/deactivation failure
- Relation creation failure

Destructive or hiding operations, specifically comment deactivation, should use
a confirmation UI before submitting.

## Validation

Client-side forms should block obviously invalid submissions:

- `project` is required.
- `title` is required for issue creation.
- `state` is required for state changes and issue creation.
- Comment `body` is required.
- Link `url` is required and should look like a URL.
- Relation `target_issue_id` is required.

The API remains the final validator. Backend validation errors should be shown
without replacing their category.

## Testing

Focused tests should cover:

- Tracker API client URL construction, bearer-token injection, and error
  mapping.
- Board grouping by state.
- Board drag state-change mapping and rollback on failure.
- Project recent-list persistence behavior.
- Home board rendering with the seven default workflow states.
- Detail page initial data loading.
- State change from detail page.
- Comment create/update/deactivate flows.
- Link attach flow.
- Relation create flow.
- New issue form validation and successful submit.

## Implementation Notes

- Use the existing Next.js app under `apps/web`; do not scaffold a separate web
  app.
- Use existing shared UI primitives from `@workspace/ui` where possible.
- Use lucide icons for icon buttons.
- Keep the first screen dense and operational rather than marketing-oriented.
- Avoid nested card layouts. Use cards only for issue cards, repeated items,
  dialogs, and form panels that need clear containment.
- Do not let generated build files such as `apps/web/next-env.d.ts` become an
  unrelated diff if build commands rewrite them.
