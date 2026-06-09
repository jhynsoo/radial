import { Inject, Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import {
  IssueBlocker,
  IssueComment,
  IssueDetail,
  IssueLink,
  IssueCycle,
  IssueProject,
  IssueProjectMilestone,
  IssueRecord,
  IssueRelation,
  IssueTeam,
  IssueView,
  IssueViewDisplayOptions,
  IssueViewFilters,
  IssueViewGroupBy,
  IssueViewLayout,
  IssueViewSortBy,
  IssueWorkflowState,
  NormalizedIssue,
  ProjectStatus,
  RelationType,
  WorkflowStateType,
} from "./issue.types"
import { ISSUE_REPOSITORY } from "./issue.repository"
import type {
  IssueRepository,
  IssueUpdatePatch,
  NewIssueRecord,
} from "./issue.repository"
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

const DEFAULT_WORKFLOW_STATES: Array<{
  name: string
  type: WorkflowStateType
}> = [
  { name: "Backlog", type: "backlog" },
  { name: "Todo", type: "unstarted" },
  { name: "In Progress", type: "started" },
  { name: "Human Review", type: "started" },
  { name: "Merging", type: "started" },
  { name: "Rework", type: "started" },
  { name: "Done", type: "completed" },
  { name: "Closed", type: "completed" },
  { name: "Canceled", type: "canceled" },
  { name: "Duplicate", type: "canceled" },
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

function hasField(body: Record<string, unknown>, fieldName: string): boolean {
  return fieldName in body
}

function defaultIssueViewFilters(): IssueViewFilters {
  return {
    query: null,
    states: [],
    assignee: null,
    labels: [],
  }
}

function defaultIssueViewDisplayOptions(): IssueViewDisplayOptions {
  return {
    layout: "kanban",
    group_by: "state",
    sort_by: "updated_at",
    show_empty_states: true,
  }
}

@Injectable()
export class IssueTrackerService {
  private readonly statesByKey = new Map<string, string>()

  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly issueRepository: IssueRepository
  ) {
    this.resetWorkflowStateCache()
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

  async listTeams(): Promise<IssueTeam[]> {
    const teams = await this.issueRepository.listTeams()

    this.rebuildWorkflowStateCache(teams)

    return teams
  }

  async createTeam(payload: unknown): Promise<IssueTeam> {
    const body = asRecord(payload)
    const createdAt = nowIso()
    const key = this.readTeamKey(body.key)
    const team = await this.issueRepository.createTeam(
      {
        key,
        name: this.readOptionalString(body.name) ?? key,
        description: this.readNullableString(body.description),
        created_at: createdAt,
        updated_at: createdAt,
      },
      this.defaultWorkflowStateRecords(key, createdAt)
    )

    this.registerWorkflowStates(team.workflow_states)

    return team
  }

  async listProjects(): Promise<IssueProject[]> {
    return this.issueRepository.listProjects()
  }

  async createProject(payload: unknown): Promise<IssueProject> {
    const body = asRecord(payload)
    const createdAt = nowIso()

    return this.issueRepository.createProject({
      slug: this.readProjectSlug(body.slug),
      name:
        this.readOptionalString(body.name) ?? this.readProjectSlug(body.slug),
      description: this.readNullableString(body.description),
      status: this.readProjectStatus(body.status),
      created_at: createdAt,
      updated_at: createdAt,
    })
  }

  async listProjectMilestones(
    projectSlug: string
  ): Promise<IssueProjectMilestone[]> {
    const slug = this.normalizeProjectSlug(projectSlug)
    const project = await this.issueRepository.findProjectBySlug(slug)

    if (!project) {
      notFound("tracker_not_found", `Project '${slug}' was not found.`)
    }

    return this.issueRepository.listProjectMilestones(slug)
  }

  async createProjectMilestone(
    projectSlug: string,
    payload: unknown
  ): Promise<IssueProjectMilestone> {
    const slug = this.normalizeProjectSlug(projectSlug)
    const project = await this.issueRepository.findProjectBySlug(slug)

    if (!project) {
      notFound("tracker_not_found", `Project '${slug}' was not found.`)
    }

    const body = asRecord(payload)
    const createdAt = nowIso()
    const existing = await this.issueRepository.listProjectMilestones(slug)
    const milestone = await this.issueRepository.createProjectMilestone({
      id: `project-milestone-${randomUUID()}`,
      project_slug: slug,
      name: this.readRequiredString(
        body.name,
        "name",
        "tracker_unknown_payload"
      ),
      description: this.readNullableString(body.description),
      target_date: this.readNullableIsoDate(body.target_date, "target_date"),
      position: existing.length,
      created_at: createdAt,
      updated_at: createdAt,
    })

    if (!milestone) {
      notFound("tracker_not_found", `Project '${slug}' was not found.`)
    }

    return milestone
  }

  async listCycles(teamKey: string): Promise<IssueCycle[]> {
    const key = this.normalizeTeamKey(teamKey)
    const team = await this.issueRepository.findTeamByKey(key)

    if (!team) {
      notFound("tracker_not_found", `Team '${key}' was not found.`)
    }

    return this.issueRepository.listCycles(key)
  }

  async createCycle(teamKey: string, payload: unknown): Promise<IssueCycle> {
    const key = this.normalizeTeamKey(teamKey)
    const team = await this.issueRepository.findTeamByKey(key)

    if (!team) {
      notFound("tracker_not_found", `Team '${key}' was not found.`)
    }

    const body = asRecord(payload)
    const startsAt = this.readRequiredIsoDate(body.starts_at, "starts_at")
    const endsAt = this.readRequiredIsoDate(body.ends_at, "ends_at")

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      badRequest("tracker_unknown_payload", "ends_at must be after starts_at.")
    }

    const createdAt = nowIso()
    const cycle = await this.issueRepository.createCycle({
      id: `cycle-${randomUUID()}`,
      team_key: key,
      name: this.readRequiredString(
        body.name,
        "name",
        "tracker_unknown_payload"
      ),
      starts_at: startsAt,
      ends_at: endsAt,
      created_at: createdAt,
      updated_at: createdAt,
    })

    if (!cycle) {
      notFound("tracker_not_found", `Team '${key}' was not found.`)
    }

    return cycle
  }

  async listIssueViews(projectSlug: string): Promise<IssueView[]> {
    const slug = this.normalizeProjectSlug(projectSlug)
    const project = await this.issueRepository.findProjectBySlug(slug)

    if (!project) {
      notFound("tracker_not_found", `Project '${slug}' was not found.`)
    }

    return this.issueRepository.listIssueViews(slug)
  }

  async createIssueView(
    projectSlug: string,
    payload: unknown
  ): Promise<IssueView> {
    const slug = this.normalizeProjectSlug(projectSlug)
    const project = await this.issueRepository.findProjectBySlug(slug)

    if (!project) {
      notFound("tracker_not_found", `Project '${slug}' was not found.`)
    }

    const body = asRecord(payload)
    const createdAt = nowIso()
    const view = await this.issueRepository.createIssueView({
      id: `issue-view-${randomUUID()}`,
      project_slug: slug,
      name: this.readRequiredString(
        body.name,
        "name",
        "tracker_unknown_payload"
      ),
      filters: await this.readIssueViewFilters(body.filters),
      display_options: this.readIssueViewDisplayOptions(body.display_options),
      created_at: createdAt,
      updated_at: createdAt,
    })

    if (!view) {
      notFound("tracker_not_found", `Project '${slug}' was not found.`)
    }

    return view
  }

  async updateIssueView(viewId: string, payload: unknown): Promise<IssueView> {
    const body = asRecord(payload)
    const patch: Parameters<IssueRepository["updateIssueView"]>[1] = {}
    const needsExistingView =
      hasField(body, "filters") || hasField(body, "display_options")
    const existingView = needsExistingView
      ? await this.issueRepository.findIssueViewById(viewId)
      : null

    if (needsExistingView && !existingView) {
      notFound("tracker_not_found", `Issue view '${viewId}' was not found.`)
    }

    if (hasField(body, "name")) {
      patch.name = this.readRequiredString(
        body.name,
        "name",
        "tracker_unknown_payload"
      )
    }
    if (hasField(body, "filters")) {
      if (!existingView) {
        notFound("tracker_not_found", `Issue view '${viewId}' was not found.`)
      }

      patch.filters = await this.readIssueViewFilters(
        body.filters,
        existingView.filters
      )
    }
    if (hasField(body, "display_options")) {
      if (!existingView) {
        notFound("tracker_not_found", `Issue view '${viewId}' was not found.`)
      }

      patch.display_options = this.readIssueViewDisplayOptions(
        body.display_options,
        existingView.display_options
      )
    }

    if (Object.keys(patch).length === 0) {
      badRequest(
        "tracker_unknown_payload",
        "Request body must include at least one editable view field."
      )
    }

    const updated = await this.issueRepository.updateIssueView(
      viewId,
      patch,
      nowIso()
    )

    if (!updated) {
      notFound("tracker_not_found", `Issue view '${viewId}' was not found.`)
    }

    return updated
  }

  async deleteIssueView(viewId: string): Promise<IssueView> {
    const view = await this.issueRepository.findIssueViewById(viewId)

    if (!view) {
      notFound("tracker_not_found", `Issue view '${viewId}' was not found.`)
    }

    const deleted = await this.issueRepository.deleteIssueView(viewId)

    if (!deleted) {
      notFound("tracker_not_found", `Issue view '${viewId}' was not found.`)
    }

    return view
  }

  async listWorkflowStates(teamKey: string): Promise<IssueWorkflowState[]> {
    const key = this.normalizeTeamKey(teamKey)
    const teams = await this.issueRepository.listTeams()
    const team = teams.find((candidate) => candidate.key === key)

    if (!team) {
      notFound("tracker_not_found", `Team '${key}' was not found.`)
    }

    this.rebuildWorkflowStateCache(teams)

    return team.workflow_states
  }

  async replaceWorkflowStates(
    teamKey: string,
    payload: unknown
  ): Promise<IssueWorkflowState[]> {
    const key = this.normalizeTeamKey(teamKey)
    const body = asRecord(payload)
    const updatedAt = nowIso()
    const states = this.readWorkflowStateRecords(key, body.states, updatedAt)
    const existingTeam = await this.issueRepository.findTeamByKey(key)

    if (!existingTeam) {
      notFound("tracker_not_found", `Team '${key}' was not found.`)
    }

    await this.rejectWorkflowStatesInUse(
      this.removedWorkflowStateNames(existingTeam.workflow_states, states)
    )

    const updated = await this.issueRepository.replaceWorkflowStates(
      key,
      states,
      updatedAt
    )

    if (!updated) {
      notFound("tracker_not_found", `Team '${key}' was not found.`)
    }

    await this.reloadPersistedWorkflowStates()

    return updated
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
      milestone_id: null,
      cycle_id: null,
      created_at: createdAt,
      updated_at: createdAt,
    }

    const blockers = await this.readBlockers(body.blocked_by)
    issue.blocked_by_ids = blockers.blockedByIds
    issue.external_blockers = blockers.externalBlockers

    return this.toIssueDetail(await this.issueRepository.createIssue(issue))
  }

  async updateIssue(issueId: string, payload: unknown): Promise<IssueDetail> {
    const issue = await this.requireIssue(issueId)
    const body = asRecord(payload)
    const patch = await this.readIssueUpdatePatch(body, issue)

    if (Object.keys(patch).length === 0) {
      badRequest(
        "tracker_unknown_payload",
        "Request body must include at least one editable issue field."
      )
    }

    const updated = await this.issueRepository.updateIssue(
      issueId,
      patch,
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

  private async readIssueUpdatePatch(
    body: Record<string, unknown>,
    issue: IssueRecord
  ): Promise<IssueUpdatePatch> {
    const patch: IssueUpdatePatch = {}

    if (hasField(body, "title")) {
      patch.title = this.readRequiredString(
        body.title,
        "title",
        "tracker_issue_create_failed"
      )
    }
    if (hasField(body, "description")) {
      patch.description = this.readNullableString(body.description)
    }
    if (hasField(body, "priority")) {
      patch.priority = this.readPriority(body.priority)
    }
    if (hasField(body, "state_name") || hasField(body, "state")) {
      patch.state = await this.readStatePatch(body)
    }
    if (hasField(body, "branch_name")) {
      patch.branch_name = this.readNullableString(body.branch_name)
    }
    if (hasField(body, "url")) {
      const url = this.readNullableString(body.url)
      if (url) {
        this.assertValidUrl(url)
      }
      patch.url = url
    }
    if (hasField(body, "labels")) {
      patch.labels = this.readLabels(body.labels)
    }
    if (hasField(body, "blocked_by")) {
      const blockers = await this.readBlockers(body.blocked_by)
      patch.blocked_by_ids = blockers.blockedByIds
      patch.external_blockers = blockers.externalBlockers
    }
    if (hasField(body, "assignee")) {
      patch.assignee = this.readNullableString(body.assignee)
    }
    if (hasField(body, "milestone_id")) {
      patch.milestone_id = await this.readMilestonePatch(
        issue.project,
        body.milestone_id
      )
    }
    if (hasField(body, "cycle_id")) {
      patch.cycle_id = this.readNullableString(body.cycle_id)
    }

    return patch
  }

  private async readStatePatch(body: Record<string, unknown>): Promise<string> {
    const states: string[] = []

    if (hasField(body, "state_name")) {
      states.push(
        await this.resolveExistingState(
          this.readRequiredString(
            body.state_name,
            "state_name",
            "tracker_invalid_state_transition"
          )
        )
      )
    }
    if (hasField(body, "state")) {
      states.push(
        await this.resolveExistingState(
          this.readRequiredString(
            body.state,
            "state",
            "tracker_invalid_state_transition"
          )
        )
      )
    }

    const uniqueStates = new Set(states)
    if (uniqueStates.size > 1) {
      badRequest(
        "tracker_invalid_state_transition",
        "state_name and state must refer to the same state."
      )
    }

    return states[0]
  }

  private async readMilestonePatch(
    projectSlug: string,
    value: unknown
  ): Promise<string | null> {
    const milestoneId = this.readNullableString(value)

    if (!milestoneId) {
      return milestoneId
    }

    const projectMilestones =
      await this.issueRepository.listProjectMilestones(projectSlug)
    const milestone = projectMilestones.find((item) => item.id === milestoneId)

    if (!milestone) {
      notFound(
        "tracker_not_found",
        `Milestone '${milestoneId}' was not found in project '${projectSlug}'.`
      )
    }

    return milestone.id
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
      assignee: issue.assignee,
      milestone_id: issue.milestone_id,
      cycle_id: issue.cycle_id,
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

  private readTeamKey(value: unknown): string {
    return this.normalizeTeamKey(
      this.readRequiredString(value, "key", "tracker_unknown_payload")
    )
  }

  private readProjectSlug(value: unknown): string {
    return this.normalizeProjectSlug(
      this.readRequiredString(value, "slug", "tracker_unknown_payload")
    )
  }

  private normalizeProjectSlug(value: string): string {
    const slug = value
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()

    if (!slug) {
      badRequest("tracker_unknown_payload", "Project slug cannot be empty.")
    }

    return slug
  }

  private normalizeTeamKey(value: string): string {
    const key = value
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase()

    if (!key) {
      badRequest("tracker_unknown_payload", "Team key cannot be empty.")
    }

    return key
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

  private readNullableString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null
    }

    if (typeof value !== "string") {
      badRequest("tracker_unknown_payload", "Expected a string or null.")
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

    return value.flatMap((item) => {
      if (typeof item !== "string") {
        badRequest("tracker_unknown_payload", "Expected a list of strings.")
      }

      const text = item.trim()

      return text.length > 0 ? [text] : []
    })
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

  private readProjectStatus(value: unknown): ProjectStatus {
    const status = this.readOptionalString(value) ?? "planned"

    if (
      status === "backlog" ||
      status === "planned" ||
      status === "in_progress" ||
      status === "completed" ||
      status === "canceled"
    ) {
      return status
    }

    badRequest(
      "tracker_unknown_payload",
      "Project status must be backlog, planned, in_progress, completed, or canceled."
    )
  }

  private readNullableIsoDate(
    value: unknown,
    fieldName: string
  ): string | null {
    if (value === undefined || value === null) {
      return null
    }

    return this.readRequiredIsoDate(value, fieldName)
  }

  private readRequiredIsoDate(value: unknown, fieldName: string): string {
    const text = this.readRequiredString(
      value,
      fieldName,
      "tracker_unknown_payload"
    )
    const date = new Date(text)

    if (Number.isNaN(date.getTime())) {
      badRequest(
        "tracker_unknown_payload",
        `${fieldName} must be a valid date.`
      )
    }

    return date.toISOString()
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

  private async readIssueViewFilters(
    value: unknown,
    base?: IssueViewFilters
  ): Promise<IssueViewFilters> {
    const body = value === undefined || value === null ? {} : asRecord(value)
    const fallback =
      value === null
        ? defaultIssueViewFilters()
        : (base ?? defaultIssueViewFilters())
    const states = hasField(body, "states")
      ? await Promise.all(
          (this.readOptionalStringList(body.states) ?? []).map((state) =>
            this.resolveExistingState(state)
          )
        )
      : [...fallback.states]

    return {
      query: hasField(body, "query")
        ? this.readNullableString(body.query)
        : fallback.query,
      states,
      assignee: hasField(body, "assignee")
        ? this.readNullableString(body.assignee)
        : fallback.assignee,
      labels: hasField(body, "labels")
        ? this.readLabels(body.labels)
        : [...fallback.labels],
    }
  }

  private readIssueViewDisplayOptions(
    value: unknown,
    base?: IssueViewDisplayOptions
  ): IssueViewDisplayOptions {
    const body = value === undefined || value === null ? {} : asRecord(value)
    const fallback =
      value === null
        ? defaultIssueViewDisplayOptions()
        : (base ?? defaultIssueViewDisplayOptions())

    return {
      layout: hasField(body, "layout")
        ? this.readIssueViewLayout(body.layout)
        : fallback.layout,
      group_by: hasField(body, "group_by")
        ? this.readIssueViewGroupBy(body.group_by)
        : fallback.group_by,
      sort_by: hasField(body, "sort_by")
        ? this.readIssueViewSortBy(body.sort_by)
        : fallback.sort_by,
      show_empty_states: hasField(body, "show_empty_states")
        ? this.readBoolean(
            body.show_empty_states,
            "show_empty_states",
            fallback.show_empty_states
          )
        : fallback.show_empty_states,
    }
  }

  private readIssueViewLayout(value: unknown): IssueViewLayout {
    const layout = this.readNullableString(value) ?? "kanban"

    if (layout === "kanban" || layout === "list") {
      return layout
    }

    badRequest("tracker_unknown_payload", "View layout must be kanban or list.")
  }

  private readIssueViewGroupBy(value: unknown): IssueViewGroupBy {
    const groupBy = this.readNullableString(value) ?? "state"

    if (
      groupBy === "state" ||
      groupBy === "assignee" ||
      groupBy === "priority"
    ) {
      return groupBy
    }

    badRequest(
      "tracker_unknown_payload",
      "View group_by must be state, assignee, or priority."
    )
  }

  private readIssueViewSortBy(value: unknown): IssueViewSortBy {
    const sortBy = this.readNullableString(value) ?? "updated_at"

    if (
      sortBy === "created_at" ||
      sortBy === "updated_at" ||
      sortBy === "priority" ||
      sortBy === "identifier"
    ) {
      return sortBy
    }

    badRequest(
      "tracker_unknown_payload",
      "View sort_by must be created_at, updated_at, priority, or identifier."
    )
  }

  private readBoolean(
    value: unknown,
    fieldName: string,
    fallback: boolean
  ): boolean {
    if (value === undefined || value === null) {
      return fallback
    }

    if (typeof value === "boolean") {
      return value
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (normalized === "true") {
        return true
      }
      if (normalized === "false") {
        return false
      }
    }

    badRequest("tracker_unknown_payload", `${fieldName} must be a boolean.`)
  }

  private readWorkflowStateType(value: unknown): WorkflowStateType {
    const stateType = this.readOptionalString(value) ?? "unstarted"

    if (
      stateType === "backlog" ||
      stateType === "unstarted" ||
      stateType === "started" ||
      stateType === "completed" ||
      stateType === "canceled"
    ) {
      return stateType
    }

    badRequest(
      "tracker_unknown_payload",
      "Workflow state type must be backlog, unstarted, started, completed, or canceled."
    )
  }

  private defaultWorkflowStateRecords(
    teamKey: string,
    createdAt: string
  ): IssueWorkflowState[] {
    return DEFAULT_WORKFLOW_STATES.map((state, index) => ({
      id: `workflow-state-${randomUUID()}`,
      team_key: teamKey,
      name: state.name,
      type: state.type,
      position: index,
      created_at: createdAt,
      updated_at: createdAt,
    }))
  }

  private readWorkflowStateRecords(
    teamKey: string,
    value: unknown,
    updatedAt: string
  ): IssueWorkflowState[] {
    if (!Array.isArray(value) || value.length === 0) {
      badRequest(
        "tracker_unknown_payload",
        "states must be a non-empty list of workflow states."
      )
    }

    const seen = new Set<string>()

    return value.map((item, index) => {
      const state = asRecord(item)
      const name = this.readRequiredString(
        state.name,
        "states.name",
        "tracker_unknown_payload"
      )
      const key = stateKey(name)

      if (seen.has(key)) {
        badRequest(
          "tracker_unknown_payload",
          "Workflow state names must be unique."
        )
      }
      seen.add(key)

      return {
        id: `workflow-state-${randomUUID()}`,
        team_key: teamKey,
        name,
        type: this.readWorkflowStateType(state.type),
        position: index,
        created_at: updatedAt,
        updated_at: updatedAt,
      }
    })
  }

  private registerWorkflowStates(states: IssueWorkflowState[]): void {
    for (const state of states) {
      this.registerState(state.name)
    }
  }

  private resetWorkflowStateCache(): void {
    this.statesByKey.clear()

    for (const state of DEFAULT_STATES) {
      this.registerState(state)
    }
  }

  private rebuildWorkflowStateCache(teams: IssueTeam[]): void {
    this.resetWorkflowStateCache()

    for (const team of teams) {
      this.registerWorkflowStates(team.workflow_states)
    }
  }

  private registerState(state: string): string {
    const trimmed = state.trim()

    if (!trimmed) {
      badRequest("tracker_state_not_found", "State name cannot be empty.")
    }

    this.statesByKey.set(stateKey(trimmed), trimmed)

    return trimmed
  }

  private async resolveExistingState(state: string): Promise<string> {
    let existing = this.statesByKey.get(stateKey(state))

    if (!existing) {
      await this.reloadPersistedWorkflowStates()
      existing = this.statesByKey.get(stateKey(state))
    }

    if (!existing) {
      badRequest("tracker_state_not_found", `State '${state}' was not found.`)
    }

    return existing
  }

  private async reloadPersistedWorkflowStates(): Promise<void> {
    const teams = await this.issueRepository.listTeams()

    this.rebuildWorkflowStateCache(teams)
  }

  private removedWorkflowStateNames(
    existingStates: IssueWorkflowState[],
    nextStates: IssueWorkflowState[]
  ): string[] {
    const nextStateKeys = new Set(
      nextStates.map((state) => stateKey(state.name))
    )

    return existingStates
      .filter((state) => !nextStateKeys.has(stateKey(state.name)))
      .map((state) => state.name)
  }

  private async rejectWorkflowStatesInUse(states: string[]): Promise<void> {
    if (states.length === 0) {
      return
    }

    const inUseStates = await this.issueRepository.findIssueStatesInUse(states)

    if (inUseStates.length === 0) {
      return
    }

    badRequest(
      "tracker_unknown_payload",
      `Workflow states cannot be removed while issues use them: ${inUseStates.join(", ")}.`
    )
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
