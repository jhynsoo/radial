import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import {
  IssueBlocker,
  IssueComment,
  IssueDetail,
  IssueLink,
  IssueRecord,
  IssueRelation,
  NormalizedIssue,
  RelationType,
} from "./issue.types"
import { badRequest, notFound } from "./tracker-errors"

const DEFAULT_STATES = [
  "Backlog",
  "Todo",
  "In Progress",
  "Human Review",
  "Merging",
  "Rework",
  "Done",
  "Closed",
  "Canceled",
  "Cancelled",
  "Duplicate",
]

const DEFAULT_PUBLIC_BASE_URL = "http://localhost:3001/api/v1"

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  badRequest("tracker_unknown_payload", "Request body must be a JSON object.")
}

function stateKey(state: string): string {
  return state.trim().toLowerCase()
}

function sameState(left: string, right: string): boolean {
  return stateKey(left) === stateKey(right)
}

function nowIso(): string {
  return new Date().toISOString()
}

@Injectable()
export class IssueTrackerService {
  private readonly issues = new Map<string, IssueRecord>()
  private readonly issueCounters = new Map<string, number>()
  private readonly statesByKey = new Map<string, string>()

  constructor() {
    for (const state of DEFAULT_STATES) {
      this.registerState(state)
    }
  }

  searchIssues(payload: unknown): NormalizedIssue[] {
    const body = asRecord(payload)
    const project = this.readRequiredString(
      body.project,
      "project",
      "missing_tracker_project_slug"
    )
    const activeStates = this.readOptionalStringList(body.active_states)
    const states = this.readOptionalStringList(body.states)
    const requestedStates = activeStates ?? states

    if (!requestedStates) {
      badRequest(
        "tracker_unknown_payload",
        "Request body must include active_states or states."
      )
    }

    if (requestedStates.length === 0) {
      return []
    }

    const assignee = this.resolveAssigneeFilter(body.assignee)

    return [...this.issues.values()]
      .filter((issue) => issue.project === project)
      .filter((issue) =>
        requestedStates.some((state) => sameState(issue.state, state))
      )
      .filter((issue) => assignee === null || issue.assignee === assignee)
      .map((issue) => this.toNormalizedIssue(issue))
  }

  lookupIssues(payload: unknown): NormalizedIssue[] {
    const body = asRecord(payload)
    const ids = this.readOptionalStringList(body.ids)

    if (!ids) {
      badRequest("tracker_unknown_payload", "Request body must include ids.")
    }

    if (ids.length === 0) {
      return []
    }

    return ids
      .map((id) => this.issues.get(id))
      .filter((issue): issue is IssueRecord => issue !== undefined)
      .map((issue) => this.toNormalizedIssue(issue))
  }

  getIssue(issueId: string): IssueDetail {
    return this.toIssueDetail(this.requireIssue(issueId))
  }

  createIssue(payload: unknown): IssueDetail {
    const body = asRecord(payload)
    const project = this.readRequiredString(
      body.project,
      "project",
      "missing_tracker_project_slug"
    )
    const title = this.readRequiredString(
      body.title,
      "title",
      "tracker_issue_create_failed"
    )
    const state = this.registerState(
      this.readOptionalString(body.state_name) ??
        this.readOptionalString(body.state) ??
        "Todo"
    )
    const createdAt = nowIso()
    const id = `issue-${randomUUID()}`
    const identifier = this.nextIdentifier(project)
    const issue: IssueRecord = {
      id,
      identifier,
      project,
      title,
      description: this.readOptionalString(body.description),
      priority: this.readPriority(body.priority),
      state,
      branch_name: this.readOptionalString(body.branch_name),
      url:
        this.readOptionalString(body.url) ??
        `${this.publicBaseUrl()}/issues/${id}`,
      labels: this.readLabels(body.labels),
      blocked_by_ids: [],
      external_blockers: [],
      assignee: this.resolveAssignee(body.assignee),
      created_at: createdAt,
      updated_at: createdAt,
      comments: [],
      links: [],
      relations: [],
    }

    const blockers = this.readBlockers(body.blocked_by)
    issue.blocked_by_ids = blockers.blockedByIds
    issue.external_blockers = blockers.externalBlockers

    this.issues.set(issue.id, issue)

    return this.toIssueDetail(issue)
  }

  updateIssue(issueId: string, payload: unknown): IssueDetail {
    const issue = this.requireIssue(issueId)
    const body = asRecord(payload)
    const state =
      this.readOptionalString(body.state_name) ??
      this.readOptionalString(body.state)

    if (!state) {
      badRequest(
        "tracker_invalid_state_transition",
        "Request body must include state_name or state."
      )
    }

    issue.state = this.resolveExistingState(state)
    issue.updated_at = nowIso()

    return this.toIssueDetail(issue)
  }

  listComments(issueId: string, includeResolved: boolean): IssueComment[] {
    const issue = this.requireIssue(issueId)

    if (includeResolved) {
      return issue.comments
    }

    return issue.comments.filter((comment) => !comment.resolved)
  }

  createComment(issueId: string, payload: unknown): IssueComment {
    const issue = this.requireIssue(issueId)
    const body = asRecord(payload)
    const bodyText = this.readRequiredString(
      body.body,
      "body",
      "tracker_unknown_payload"
    )
    const createdAt = nowIso()
    const comment: IssueComment = {
      id: `comment-${randomUUID()}`,
      issue_id: issue.id,
      body: bodyText,
      resolved: false,
      created_at: createdAt,
      updated_at: createdAt,
    }

    issue.comments.push(comment)
    issue.updated_at = createdAt

    return comment
  }

  updateComment(commentId: string, payload: unknown): IssueComment {
    const { issue, comment } = this.requireComment(commentId)
    const body = asRecord(payload)
    comment.body = this.readRequiredString(
      body.body,
      "body",
      "tracker_comment_update_failed"
    )
    comment.updated_at = nowIso()
    issue.updated_at = comment.updated_at

    return comment
  }

  deactivateComment(commentId: string): IssueComment {
    const { issue, comment } = this.requireComment(commentId)
    comment.resolved = true
    comment.updated_at = nowIso()
    issue.updated_at = comment.updated_at

    return comment
  }

  listLinks(issueId: string): IssueLink[] {
    return this.requireIssue(issueId).links
  }

  attachLink(issueId: string, payload: unknown): IssueLink {
    const issue = this.requireIssue(issueId)
    const body = asRecord(payload)
    const url = this.readRequiredString(
      body.url,
      "url",
      "tracker_link_attach_failed"
    )
    this.assertValidUrl(url)

    const createdAt = nowIso()
    const link: IssueLink = {
      id: `link-${randomUUID()}`,
      issue_id: issue.id,
      url,
      title:
        this.readOptionalString(body.title) ??
        this.readOptionalString(body.title_or_type),
      type: this.readOptionalString(body.type),
      created_at: createdAt,
    }

    issue.links.push(link)
    issue.updated_at = createdAt

    return link
  }

  createRelation(issueId: string, payload: unknown): IssueRelation {
    const source = this.requireIssue(issueId)
    const body = asRecord(payload)
    const relationType = this.readRelationType(body.relation_type)
    const targetIssueId = this.readRequiredString(
      body.target_issue_id,
      "target_issue_id",
      "tracker_relation_create_failed"
    )
    const target = this.requireIssue(targetIssueId)
    const createdAt = nowIso()
    const relation: IssueRelation = {
      id: `relation-${randomUUID()}`,
      source_issue_id: source.id,
      relation_type: relationType,
      target_issue_id: target.id,
      created_at: createdAt,
    }

    source.relations.push(relation)

    if (
      relationType === "blocked_by" &&
      !source.blocked_by_ids.includes(target.id)
    ) {
      source.blocked_by_ids.push(target.id)
    }

    source.updated_at = createdAt

    return relation
  }

  getCurrentUser() {
    return {
      id: "me",
      name: process.env.TRACKER_USER_NAME ?? "Radial API",
      email: process.env.TRACKER_USER_EMAIL ?? null,
    }
  }

  private requireIssue(issueId: string): IssueRecord {
    const issue = this.issues.get(issueId)

    if (!issue) {
      notFound("tracker_not_found", `Issue '${issueId}' was not found.`)
    }

    return issue
  }

  private requireComment(commentId: string): {
    issue: IssueRecord
    comment: IssueComment
  } {
    for (const issue of this.issues.values()) {
      const comment = issue.comments.find((item) => item.id === commentId)

      if (comment) {
        return { issue, comment }
      }
    }

    notFound(
      "tracker_comment_not_found",
      `Comment '${commentId}' was not found.`
    )
  }

  private toIssueDetail(issue: IssueRecord): IssueDetail {
    return {
      ...this.toNormalizedIssue(issue),
      project: issue.project,
      comments: issue.comments,
      links: issue.links,
      relations: issue.relations,
    }
  }

  private toNormalizedIssue(issue: IssueRecord): NormalizedIssue {
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      state: issue.state,
      branch_name: issue.branch_name,
      url: issue.url,
      labels: issue.labels,
      blocked_by: this.resolveBlockers(issue),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }
  }

  private resolveBlockers(issue: IssueRecord): IssueBlocker[] {
    const knownBlockers = issue.blocked_by_ids.map((blockerId) => {
      const blocker = this.issues.get(blockerId)

      if (!blocker) {
        return {
          id: blockerId,
          identifier: blockerId,
          state: null,
        }
      }

      return {
        id: blocker.id,
        identifier: blocker.identifier,
        state: blocker.state,
      }
    })

    return [...knownBlockers, ...issue.external_blockers]
  }

  private readBlockers(value: unknown): {
    blockedByIds: string[]
    externalBlockers: IssueBlocker[]
  } {
    if (value === undefined || value === null) {
      return { blockedByIds: [], externalBlockers: [] }
    }

    if (!Array.isArray(value)) {
      badRequest("tracker_unknown_payload", "blocked_by must be a list.")
    }

    const blockedByIds: string[] = []
    const externalBlockers: IssueBlocker[] = []

    for (const blocker of value) {
      if (typeof blocker === "string") {
        if (this.issues.has(blocker)) {
          blockedByIds.push(blocker)
        } else {
          externalBlockers.push({
            id: blocker,
            identifier: blocker,
            state: null,
          })
        }
        continue
      }

      if (
        typeof blocker === "object" &&
        blocker !== null &&
        !Array.isArray(blocker)
      ) {
        const blockerRecord = blocker as Record<string, unknown>
        const id = this.readRequiredString(
          blockerRecord.id,
          "blocked_by.id",
          "tracker_unknown_payload"
        )

        if (this.issues.has(id)) {
          blockedByIds.push(id)
        } else {
          externalBlockers.push({
            id,
            identifier: this.readOptionalString(blockerRecord.identifier) ?? id,
            state: this.readOptionalString(blockerRecord.state),
          })
        }
        continue
      }

      badRequest(
        "tracker_unknown_payload",
        "blocked_by entries must be strings or objects."
      )
    }

    return {
      blockedByIds: [...new Set(blockedByIds)],
      externalBlockers,
    }
  }

  private resolveAssignee(value: unknown): string | null {
    const assignee = this.readOptionalString(value)

    if (!assignee) {
      return null
    }

    return assignee === "me" ? this.getCurrentUser().id : assignee
  }

  private resolveAssigneeFilter(value: unknown): string | null {
    return this.resolveAssignee(value)
  }

  private readRequiredString(
    value: unknown,
    fieldName: string,
    category: Parameters<typeof badRequest>[0]
  ): string {
    const text = this.readOptionalString(value)

    if (!text) {
      badRequest(category, `${fieldName} is required.`)
    }

    return text
  }

  private readOptionalString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null
    }

    if (typeof value !== "string") {
      return null
    }

    const text = value.trim()

    return text.length > 0 ? text : null
  }

  private readOptionalStringList(value: unknown): string[] | null {
    if (value === undefined || value === null) {
      return null
    }

    if (!Array.isArray(value)) {
      badRequest("tracker_unknown_payload", "Expected a list of strings.")
    }

    return value
      .map((item) => this.readOptionalString(item))
      .filter((item): item is string => item !== null)
  }

  private readLabels(value: unknown): string[] {
    return [
      ...new Set(
        (this.readOptionalStringList(value) ?? []).map((label) =>
          label.toLowerCase()
        )
      ),
    ]
  }

  private readPriority(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null
    }

    if (typeof value === "number" && Number.isInteger(value)) {
      return value
    }

    if (typeof value === "string") {
      const parsed = Number(value)

      if (Number.isInteger(parsed)) {
        return parsed
      }
    }

    badRequest(
      "tracker_unknown_payload",
      "priority must be an integer or null."
    )
  }

  private readRelationType(value: unknown): RelationType {
    const relationType = this.readRequiredString(
      value,
      "relation_type",
      "tracker_relation_create_failed"
    )

    if (relationType === "related" || relationType === "blocked_by") {
      return relationType
    }

    badRequest(
      "tracker_relation_create_failed",
      "relation_type must be related or blocked_by."
    )
  }

  private registerState(state: string): string {
    const trimmed = state.trim()

    if (!trimmed) {
      badRequest("tracker_state_not_found", "State name cannot be empty.")
    }

    this.statesByKey.set(stateKey(trimmed), trimmed)

    return trimmed
  }

  private resolveExistingState(state: string): string {
    const existing = this.statesByKey.get(stateKey(state))

    if (!existing) {
      badRequest("tracker_state_not_found", `State '${state}' was not found.`)
    }

    return existing
  }

  private nextIdentifier(project: string): string {
    const prefix = project
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase()
    const safePrefix = prefix.length > 0 ? prefix : "ISSUE"
    const next = (this.issueCounters.get(safePrefix) ?? 0) + 1
    this.issueCounters.set(safePrefix, next)

    return `${safePrefix}-${next}`
  }

  private publicBaseUrl(): string {
    return (
      process.env.TRACKER_PUBLIC_URL?.replace(/\/$/g, "") ??
      DEFAULT_PUBLIC_BASE_URL
    )
  }

  private assertValidUrl(value: string): void {
    try {
      new URL(value)
    } catch {
      badRequest("tracker_link_attach_failed", "url must be a valid URL.")
    }
  }
}
