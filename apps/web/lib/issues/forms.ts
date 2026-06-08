import type {
  CreateIssueBody,
  RelationType,
  UpdateIssueBody,
} from "../tracker/types"

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function required(formData: FormData, key: string, label: string): string {
  const value = text(formData, key)
  if (!value) {
    throw new Error(`${label} is required.`)
  }
  return value
}

function commaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function optionalText(
  formData: FormData,
  key: string
): string | undefined {
  const value = text(formData, key)
  return value || undefined
}

function parsePriority(value: string): number | null {
  if (!value) {
    return null
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error("Priority must be an integer.")
  }

  const priority = Number(value)
  if (!Number.isInteger(priority)) {
    throw new Error("Priority must be an integer.")
  }

  return priority
}

function validateUrl(url: string): string {
  try {
    new URL(url)
  } catch {
    throw new Error("URL must be a valid URL.")
  }

  return url
}

export function parseIssueForm(formData: FormData): CreateIssueBody {
  const labels = commaList(text(formData, "labels"))
  const blockedBy = commaList(text(formData, "blocked_by"))
  const body: CreateIssueBody = {
    project: required(formData, "project", "Project"),
    title: required(formData, "title", "Title"),
    state: required(formData, "state", "State"),
    priority: parsePriority(text(formData, "priority")),
  }

  const description = optionalText(formData, "description")
  const assignee = optionalText(formData, "assignee")
  const branchName = optionalText(formData, "branch_name")
  const url = optionalText(formData, "url")

  if (description) {
    body.description = description
  }
  if (labels.length > 0) {
    body.labels = labels
  }
  if (blockedBy.length > 0) {
    body.blocked_by = blockedBy
  }
  if (assignee) {
    body.assignee = assignee
  }
  if (branchName) {
    body.branch_name = branchName
  }
  if (url) {
    body.url = validateUrl(url)
  }

  return body
}

export function parseIssueUpdateForm(formData: FormData): UpdateIssueBody {
  const labels = commaList(text(formData, "labels"))
  const blockedBy = commaList(text(formData, "blocked_by"))
  const url = optionalText(formData, "url")

  return {
    title: required(formData, "title", "Title"),
    description: text(formData, "description") || null,
    state: required(formData, "state", "State"),
    priority: parsePriority(text(formData, "priority")),
    labels,
    blocked_by: blockedBy,
    assignee: text(formData, "assignee") || null,
    branch_name: text(formData, "branch_name") || null,
    url: url ? validateUrl(url) : null,
  }
}

export function parseCommentBody(formData: FormData): string {
  return required(formData, "body", "Body")
}

export function parseLinkForm(formData: FormData): {
  url: string
  title?: string
  type?: string
} {
  const url = validateUrl(required(formData, "url", "URL"))
  const link: { url: string; title?: string; type?: string } = { url }
  const title = optionalText(formData, "title")
  const type = optionalText(formData, "type")

  if (title) {
    link.title = title
  }
  if (type) {
    link.type = type
  }

  return link
}

export function parseRelationForm(formData: FormData): {
  relation_type: RelationType
  target_issue_id: string
} {
  const relationType = required(formData, "relation_type", "Relation type")

  if (relationType !== "related" && relationType !== "blocked_by") {
    throw new Error("Relation type must be related or blocked_by.")
  }

  return {
    relation_type: relationType,
    target_issue_id: required(formData, "target_issue_id", "Target issue"),
  }
}
