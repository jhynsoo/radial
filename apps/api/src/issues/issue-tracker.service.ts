import { Inject, Injectable } from "@nestjs/common"
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
import { ISSUE_REPOSITORY } from "./issue.repository"
import type { IssueRepository, NewIssueRecord } from "./issue.repository"
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

function nowIso(): string {
  return new Date().toISOString()
}

@Injectable()
export class IssueTrackerService {
  private readonly statesByKey = new Map<string, string>()

  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly issueRepository: IssueRepository
  ) {
    for (const state of DEFAULT_STATES) {
      this.registerState(state)
    }
  }

  async searchIssues(payload: unknown): Promise<NormalizedIssue[]> {
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
    const issues = await this.issueRepository.searchIssues({
      project,
      states: requestedStates,
      assignee,
    })

    return Promise.all(issues.map((issue) => this.toNormalizedIssue(issue)))
  }

  async lookupIssues(payload: unknown): Promise<NormalizedIssue[]> {
    const body = asRecord(payload)
    const ids = this.readOptionalStringList(body.ids)

    if (!ids) {
      badRequest("tracker_unknown_payload", "Request body must include ids.")
    }

    if (ids.length === 0) {
      return []
    }

    const issues = await this.issueRepository.findIssuesByIds(ids)

    return Promise.all(issues.map((issue) => this.toNormalizedIssue(issue)))
  }

  async getIssue(issueId: string): Promise<IssueDetail> {
    return this.toIssueDetail(await this.requireIssue(issueId))
  }

  async createIssue(payload: unknown): Promise<IssueDetail> {
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
    const issue: NewIssueRecord = {
      id,
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
    }

    const blockers = await this.readBlockers(body.blocked_by)
    issue.blocked_by_ids = blockers.blockedByIds
    issue.external_blockers = blockers.externalBlockers

    return this.toIssueDetail(await this.issueRepository.createIssue(issue))
  }

  async updateIssue(issueId: string, payload: unknown): Promise<IssueDetail> {
    await this.requireIssue(issueId)
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

    const updated = await this.issueRepository.updateIssueState(
      issueId,
      this.resolveExistingState(state),
      nowIso()
    )

    if (!updated) {
      notFound("tracker_not_found", `Issue '${issueId}' was not found.`)
    }

    return this.toIssueDetail(updated)
  }

  async listComments(
    issueId: string,
    includeResolved: boolean
  ): Promise<IssueComment[]> {
    const issue = await this.requireIssue(issueId)

    if (includeResolved) {
      return issue.comments
    }

    return issue.comments.filter((comment) => !comment.resolved)
  }

  async createComment(
    issueId: string,
    payload: unknown
  ): Promise<IssueComment> {
    const issue = await this.requireIssue(issueId)
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

    const created = await this.issueRepository.createComment(
      issue.id,
      comment,
      createdAt
    )

    if (!created) {
      notFound("tracker_not_found", `Issue '${issueId}' was not found.`)
    }

    return created
  }

  async updateComment(
    commentId: string,
    payload: unknown
  ): Promise<IssueComment> {
    const body = asRecord(payload)
    const bodyText = this.readRequiredString(
      body.body,
      "body",
      "tracker_comment_update_failed"
    )
    const updated = await this.issueRepository.updateComment(
      commentId,
      bodyText,
      nowIso()
    )

    if (!updated) {
      notFound(
        "tracker_comment_not_found",
        `Comment '${commentId}' was not found.`
      )
    }

    return updated
  }

  async deactivateComment(commentId: string): Promise<IssueComment> {
    const updated = await this.issueRepository.deactivateComment(
      commentId,
      nowIso()
    )

    if (!updated) {
      notFound(
        "tracker_comment_not_found",
        `Comment '${commentId}' was not found.`
      )
    }

    return updated
  }

  async listLinks(issueId: string): Promise<IssueLink[]> {
    return (await this.requireIssue(issueId)).links
  }

  async attachLink(issueId: string, payload: unknown): Promise<IssueLink> {
    const issue = await this.requireIssue(issueId)
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

    const attached = await this.issueRepository.attachLink(
      issue.id,
      link,
      createdAt
    )

    if (!attached) {
      notFound("tracker_not_found", `Issue '${issueId}' was not found.`)
    }

    return attached
  }

  async createRelation(
    issueId: string,
    payload: unknown
  ): Promise<IssueRelation> {
    const source = await this.requireIssue(issueId)
    const body = asRecord(payload)
    const relationType = this.readRelationType(body.relation_type)
    const targetIssueId = this.readRequiredString(
      body.target_issue_id,
      "target_issue_id",
      "tracker_relation_create_failed"
    )
    const target = await this.requireIssue(targetIssueId)
    const createdAt = nowIso()
    const relation: IssueRelation = {
      id: `relation-${randomUUID()}`,
      source_issue_id: source.id,
      relation_type: relationType,
      target_issue_id: target.id,
      created_at: createdAt,
    }

    const created = await this.issueRepository.createRelation(
      relation,
      createdAt
    )

    if (!created) {
      notFound("tracker_not_found", `Issue '${issueId}' was not found.`)
    }

    return created
  }

  getCurrentUser() {
    return {
      id: "me",
      name: process.env.TRACKER_USER_NAME ?? "Radial API",
      email: process.env.TRACKER_USER_EMAIL ?? null,
    }
  }

  private async requireIssue(issueId: string): Promise<IssueRecord> {
    const issue = await this.issueRepository.findIssueById(issueId)

    if (!issue) {
      notFound("tracker_not_found", `Issue '${issueId}' was not found.`)
    }

    return issue
  }

  private async toIssueDetail(issue: IssueRecord): Promise<IssueDetail> {
    return {
      ...(await this.toNormalizedIssue(issue)),
      project: issue.project,
      comments: issue.comments.filter((comment) => !comment.resolved),
      links: issue.links,
      relations: issue.relations,
    }
  }

  private async toNormalizedIssue(
    issue: IssueRecord
  ): Promise<NormalizedIssue> {
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
      blocked_by: await this.resolveBlockers(issue),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }
  }

  private async resolveBlockers(issue: IssueRecord): Promise<IssueBlocker[]> {
    const blockers = await this.issueRepository.findIssuesByIds(
      issue.blocked_by_ids
    )
    const blockersById = new Map(
      blockers.map((blocker) => [blocker.id, blocker])
    )
    const knownBlockers = issue.blocked_by_ids.map((blockerId) => {
      const blocker = blockersById.get(blockerId)

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

  private async readBlockers(value: unknown): Promise<{
    blockedByIds: string[]
    externalBlockers: IssueBlocker[]
  }> {
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
        if (await this.issueRepository.issueExists(blocker)) {
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

        if (await this.issueRepository.issueExists(id)) {
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
