import "server-only"

import type {
  CreateIssueBody,
  CreateIssueViewBody,
  CurrentUser,
  IssueComment,
  IssueDetail,
  IssueLink,
  IssueRelation,
  IssueView,
  NormalizedIssue,
  RelationType,
  SearchIssuesBody,
  TrackerErrorBody,
  UpdateIssueViewBody,
  UpdateIssueBody,
} from "./types"

export class TrackerClientError extends Error {
  constructor(
    public readonly category: TrackerErrorBody["error"]["category"],
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = "TrackerClientError"
  }
}

function baseUrl(): string {
  return (
    process.env.TRACKER_API_BASE_URL?.replace(/\/$/g, "") ??
    "http://localhost:3001/api/v1"
  )
}

function headers(): HeadersInit {
  const token = process.env.TRACKER_API_KEY?.trim()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function readError(response: Response): Promise<TrackerClientError> {
  try {
    const body = (await response.json()) as Partial<TrackerErrorBody>
    if (body.error?.category && body.error.message) {
      return new TrackerClientError(
        body.error.category,
        body.error.message,
        response.status
      )
    }
  } catch {
    return new TrackerClientError(
      "tracker_decode_error",
      `Tracker returned HTTP ${response.status}.`,
      response.status
    )
  }

  return new TrackerClientError(
    "tracker_bad_status",
    `Tracker returned HTTP ${response.status}.`,
    response.status
  )
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    throw new TrackerClientError(
      "tracker_decode_error",
      `Tracker returned invalid JSON for HTTP ${response.status}.`,
      response.status
    )
  }
}

async function requestTracker<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        ...headers(),
        ...init.headers,
      },
      cache: "no-store",
    })
  } catch (error) {
    throw new TrackerClientError(
      "tracker_request_failed",
      error instanceof Error ? error.message : "Tracker request failed."
    )
  }

  if (!response.ok) {
    throw await readError(response)
  }

  return readJson<T>(response)
}

export async function searchIssues(
  body: SearchIssuesBody
): Promise<NormalizedIssue[]> {
  const response = await requestTracker<{ issues: NormalizedIssue[] }>(
    "/issues/search",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  )
  return response.issues
}

export async function getIssue(issueId: string): Promise<IssueDetail> {
  const response = await requestTracker<{ issue: IssueDetail }>(
    `/issues/${encodeURIComponent(issueId)}`,
    { method: "GET" }
  )
  return response.issue
}

export async function createIssue(body: CreateIssueBody): Promise<IssueDetail> {
  const response = await requestTracker<{ issue: IssueDetail }>("/issues", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return response.issue
}

export async function updateIssueState(
  issueId: string,
  state: string
): Promise<IssueDetail> {
  const response = await requestTracker<{ issue: IssueDetail }>(
    `/issues/${encodeURIComponent(issueId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ state }),
    }
  )
  return response.issue
}

export async function updateIssue(
  issueId: string,
  body: UpdateIssueBody
): Promise<IssueDetail> {
  const response = await requestTracker<{ issue: IssueDetail }>(
    `/issues/${encodeURIComponent(issueId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  )
  return response.issue
}

export async function createComment(
  issueId: string,
  body: string
): Promise<IssueComment> {
  const response = await requestTracker<{ comment: IssueComment }>(
    `/issues/${encodeURIComponent(issueId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  )
  return response.comment
}

export async function listComments(
  issueId: string,
  includeResolved = false
): Promise<IssueComment[]> {
  const suffix = includeResolved ? "?include_resolved=true" : ""
  const response = await requestTracker<{ comments: IssueComment[] }>(
    `/issues/${encodeURIComponent(issueId)}/comments${suffix}`,
    { method: "GET" }
  )
  return response.comments
}

export async function updateComment(
  commentId: string,
  body: string
): Promise<IssueComment> {
  const response = await requestTracker<{ comment: IssueComment }>(
    `/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
    }
  )
  return response.comment
}

export async function deactivateComment(
  commentId: string
): Promise<IssueComment> {
  const response = await requestTracker<{ comment: IssueComment }>(
    `/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" }
  )
  return response.comment
}

export async function listLinks(issueId: string): Promise<IssueLink[]> {
  const response = await requestTracker<{ links: IssueLink[] }>(
    `/issues/${encodeURIComponent(issueId)}/links`,
    { method: "GET" }
  )
  return response.links
}

export async function attachLink(
  issueId: string,
  body: { url: string; title?: string; type?: string }
): Promise<IssueLink> {
  const response = await requestTracker<{ link: IssueLink }>(
    `/issues/${encodeURIComponent(issueId)}/links`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  )
  return response.link
}

export async function createRelation(
  issueId: string,
  body: { relation_type: RelationType; target_issue_id: string }
): Promise<IssueRelation> {
  const response = await requestTracker<{ relation: IssueRelation }>(
    `/issues/${encodeURIComponent(issueId)}/relations`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  )
  return response.relation
}

export async function listIssueViews(
  projectSlug: string
): Promise<IssueView[]> {
  const response = await requestTracker<{ views: IssueView[] }>(
    `/projects/${encodeURIComponent(projectSlug)}/views`,
    { method: "GET" }
  )
  return response.views
}

export async function createIssueView(
  projectSlug: string,
  body: CreateIssueViewBody
): Promise<IssueView> {
  const response = await requestTracker<{ view: IssueView }>(
    `/projects/${encodeURIComponent(projectSlug)}/views`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  )
  return response.view
}

export async function updateIssueView(
  viewId: string,
  body: UpdateIssueViewBody
): Promise<IssueView> {
  const response = await requestTracker<{ view: IssueView }>(
    `/views/${encodeURIComponent(viewId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  )
  return response.view
}

export async function deleteIssueView(viewId: string): Promise<IssueView> {
  const response = await requestTracker<{ view: IssueView }>(
    `/views/${encodeURIComponent(viewId)}`,
    { method: "DELETE" }
  )
  return response.view
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await requestTracker<{ user: CurrentUser }>("/users/me", {
    method: "GET",
  })
  return response.user
}
