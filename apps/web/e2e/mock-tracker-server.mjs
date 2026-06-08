import http from "node:http"

const port = 3101
const states = [
  "Backlog",
  "Todo",
  "In Progress",
  "Human Review",
  "Merging",
  "Rework",
  "Done",
]

let issues = []
let comments = []
let links = []
let relations = []
let nextIssueNumber = 1
let nextCommentNumber = 1
let nextLinkNumber = 1
let nextRelationNumber = 1

function now() {
  return new Date().toISOString()
}

function identifierFor(project, issueNumber) {
  return `${project.slice(0, 3).toUpperCase()}-${issueNumber}`
}

function createSeedIssue(body) {
  const issueNumber = nextIssueNumber++
  const createdAt = now()
  const issue = {
    id: `issue-${issueNumber}`,
    identifier: identifierFor(body.project, issueNumber),
    project: body.project,
    title: body.title,
    description: body.description ?? null,
    priority: body.priority ?? null,
    state: body.state ?? body.state_name ?? "Todo",
    branch_name: body.branch_name ?? null,
    url: body.url ?? null,
    assignee: body.assignee ?? null,
    labels: body.labels ?? [],
    blocked_by: body.blocked_by ?? [],
    created_at: createdAt,
    updated_at: createdAt,
  }

  issues.push(issue)
  return issue
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function stringList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : []
}

function resetStore() {
  issues = []
  comments = []
  links = []
  relations = []
  nextIssueNumber = 1
  nextCommentNumber = 1
  nextLinkNumber = 1
  nextRelationNumber = 1

  createSeedIssue({
    project: "radial",
    title: "Plan board-first issue console",
    description: "Frame the first screen around the workflow board.",
    state: "Backlog",
    priority: 3,
    labels: ["web"],
  })
  createSeedIssue({
    project: "radial",
    title: "Fix API contract search",
    description: "Verify tracker search filters against workflow states.",
    state: "Todo",
    priority: 1,
    assignee: "me",
    labels: ["api", "contract"],
    blocked_by: ["issue-1"],
  })
  createSeedIssue({
    project: "radial",
    title: "Review mutation forms",
    description: "Check detail page mutations from the browser.",
    state: "In Progress",
    labels: ["web"],
  })
  createSeedIssue({
    project: "radial",
    title: "Ship completed workflow",
    state: "Done",
    labels: ["release"],
  })
  createSeedIssue({
    project: "orbit",
    title: "Orbit only task",
    state: "Todo",
  })
}

function issueSummary(issue) {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    state: issue.state,
    branch_name: issue.branch_name,
    url: issue.url,
    assignee: issue.assignee ?? null,
    labels: issue.labels,
    blocked_by: issue.blocked_by.map((blockerId) => {
      const blocker = findIssue(blockerId)
      return {
        id: blockerId,
        identifier: blocker?.identifier ?? blockerId,
        state: blocker?.state ?? null,
      }
    }),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
  }
}

function issueDetail(issue) {
  return {
    ...issueSummary(issue),
    project: issue.project,
    comments: comments.filter(
      (comment) => comment.issue_id === issue.id && !comment.resolved
    ),
    links: links.filter((link) => link.issue_id === issue.id),
    relations: relations.filter(
      (relation) => relation.source_issue_id === issue.id
    ),
  }
}

function findIssue(issueId) {
  return issues.find((issue) => issue.id === issueId)
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" })
  response.end(JSON.stringify(body))
}

function sendNotFound(response, message = "Not found.") {
  sendJson(response, 404, {
    error: {
      category: "tracker_not_found",
      message,
    },
  })
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const raw = chunks.map((chunk) => chunk.toString()).join("")
  return raw ? JSON.parse(raw) : {}
}

function matchesSearch(issue, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  return [
    issue.identifier,
    issue.title,
    issue.description ?? "",
    ...issue.labels,
  ].some((value) => value.toLowerCase().includes(needle))
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`)
  const pathname = url.pathname

  if (request.method === "GET" && pathname === "/__test/health") {
    sendJson(response, 200, { status: "ok" })
    return
  }

  if (request.method === "POST" && pathname === "/__test/reset") {
    resetStore()
    sendJson(response, 200, { status: "reset" })
    return
  }

  if (request.method === "GET" && pathname === "/api/v1/users/me") {
    sendJson(response, 200, {
      user: {
        id: "me",
        name: "Radial Mock",
        email: null,
      },
    })
    return
  }

  if (request.method === "POST" && pathname === "/api/v1/issues/search") {
    const body = await readBody(request)
    const selectedStates = new Set(
      (body.states ?? body.active_states ?? states).map((state) =>
        String(state).trim().toLowerCase()
      )
    )
    const results = issues
      .filter((issue) => issue.project === body.project)
      .filter((issue) => selectedStates.has(issue.state.toLowerCase()))
      .filter(
        (issue) =>
          !body.assignee ||
          String(issue.assignee ?? "").toLowerCase() ===
            String(body.assignee).trim().toLowerCase()
      )
      .filter((issue) => matchesSearch(issue, String(body.q ?? "")))
      .map(issueSummary)

    sendJson(response, 200, { issues: results })
    return
  }

  if (request.method === "POST" && pathname === "/api/v1/issues") {
    const body = await readBody(request)
    const issue = createSeedIssue({
      project: String(body.project),
      title: String(body.title),
      description: body.description ? String(body.description) : undefined,
      state: body.state ? String(body.state) : undefined,
      state_name: body.state_name ? String(body.state_name) : undefined,
      priority: body.priority ?? null,
      labels: Array.isArray(body.labels) ? body.labels.map(String) : [],
      assignee: body.assignee ? String(body.assignee) : undefined,
      blocked_by: Array.isArray(body.blocked_by)
        ? body.blocked_by.map(String)
        : [],
      branch_name: body.branch_name ? String(body.branch_name) : undefined,
      url: body.url ? String(body.url) : undefined,
    })
    sendJson(response, 201, { issue: issueDetail(issue) })
    return
  }

  const issueMatch = pathname.match(/^\/api\/v1\/issues\/([^/]+)$/)
  if (issueMatch) {
    const issue = findIssue(decodeURIComponent(issueMatch[1]))
    if (!issue) {
      sendNotFound(response, "Issue was not found.")
      return
    }

    if (request.method === "GET") {
      sendJson(response, 200, { issue: issueDetail(issue) })
      return
    }

    if (request.method === "PATCH") {
      const body = await readBody(request)
      if ("title" in body) {
        issue.title = String(body.title).trim()
      }
      if ("description" in body) {
        issue.description = optionalString(body.description)
      }
      if ("state" in body || "state_name" in body) {
        issue.state = String(body.state ?? body.state_name ?? issue.state)
      }
      if ("priority" in body) {
        issue.priority =
          body.priority === null || body.priority === undefined
            ? null
            : Number(body.priority)
      }
      if ("labels" in body) {
        issue.labels = stringList(body.labels)
      }
      if ("blocked_by" in body) {
        issue.blocked_by = stringList(body.blocked_by)
      }
      if ("branch_name" in body) {
        issue.branch_name = optionalString(body.branch_name)
      }
      if ("url" in body) {
        issue.url = optionalString(body.url)
      }
      if ("assignee" in body) {
        issue.assignee = optionalString(body.assignee)
      }
      issue.updated_at = now()
      sendJson(response, 200, { issue: issueDetail(issue) })
      return
    }
  }

  const commentsMatch = pathname.match(/^\/api\/v1\/issues\/([^/]+)\/comments$/)
  if (commentsMatch && request.method === "POST") {
    const issueId = decodeURIComponent(commentsMatch[1])
    if (!findIssue(issueId)) {
      sendNotFound(response, "Issue was not found.")
      return
    }

    const body = await readBody(request)
    const timestamp = now()
    const comment = {
      id: `comment-${nextCommentNumber++}`,
      issue_id: issueId,
      body: String(body.body),
      resolved: false,
      created_at: timestamp,
      updated_at: timestamp,
    }
    comments.push(comment)
    sendJson(response, 201, { comment })
    return
  }

  const commentMatch = pathname.match(/^\/api\/v1\/comments\/([^/]+)$/)
  if (commentMatch) {
    const comment = comments.find(
      (candidate) => candidate.id === decodeURIComponent(commentMatch[1])
    )
    if (!comment) {
      sendJson(response, 404, {
        error: {
          category: "tracker_comment_not_found",
          message: "Comment was not found.",
        },
      })
      return
    }

    if (request.method === "PATCH") {
      const body = await readBody(request)
      comment.body = String(body.body)
      comment.updated_at = now()
      sendJson(response, 200, { comment })
      return
    }

    if (request.method === "DELETE") {
      comment.resolved = true
      comment.updated_at = now()
      sendJson(response, 200, { comment })
      return
    }
  }

  const linksMatch = pathname.match(/^\/api\/v1\/issues\/([^/]+)\/links$/)
  if (linksMatch && request.method === "POST") {
    const issueId = decodeURIComponent(linksMatch[1])
    if (!findIssue(issueId)) {
      sendNotFound(response, "Issue was not found.")
      return
    }

    const body = await readBody(request)
    const link = {
      id: `link-${nextLinkNumber++}`,
      issue_id: issueId,
      url: String(body.url),
      title: body.title ? String(body.title) : null,
      type: body.type ? String(body.type) : null,
      created_at: now(),
    }
    links.push(link)
    sendJson(response, 201, { link })
    return
  }

  const relationsMatch = pathname.match(
    /^\/api\/v1\/issues\/([^/]+)\/relations$/
  )
  if (relationsMatch && request.method === "POST") {
    const issueId = decodeURIComponent(relationsMatch[1])
    if (!findIssue(issueId)) {
      sendNotFound(response, "Issue was not found.")
      return
    }

    const body = await readBody(request)
    const relation = {
      id: `relation-${nextRelationNumber++}`,
      source_issue_id: issueId,
      relation_type: String(body.relation_type),
      target_issue_id: String(body.target_issue_id),
      created_at: now(),
    }
    relations.push(relation)
    sendJson(response, 201, { relation })
    return
  }

  sendNotFound(response)
}

resetStore()

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, {
      error: {
        category: "tracker_request_failed",
        message: error instanceof Error ? error.message : "Mock server failed.",
      },
    })
  })
})

server.listen(port, "127.0.0.1")
