import { Injectable } from "@nestjs/common"
import {
  IssueComment,
  IssueCycle,
  IssueLink,
  IssueProject,
  IssueProjectMilestone,
  IssueRecord,
  IssueRelation,
  IssueTeam,
  IssueView,
  IssueWorkflowState,
} from "./issue.types"
import {
  IssueRepository,
  IssueUpdatePatch,
  IssueViewUpdatePatch,
  NewCycleRecord,
  NewIssueViewRecord,
  NewProjectMilestoneRecord,
  NewProjectRecord,
  NewTeamRecord,
  NewWorkflowStateRecord,
  NewIssueRecord,
  issueIdentifierPrefix,
} from "./issue.repository"

function stateKey(state: string): string {
  return state.trim().toLowerCase()
}

function sameState(left: string, right: string): boolean {
  return stateKey(left) === stateKey(right)
}

@Injectable()
export class InMemoryIssueRepository implements IssueRepository {
  private readonly issues = new Map<string, IssueRecord>()
  private readonly issueCounters = new Map<string, number>()
  private readonly teams = new Map<string, IssueTeam>()
  private readonly projects = new Map<string, IssueProject>()
  private readonly milestones = new Map<string, IssueProjectMilestone>()
  private readonly cycles = new Map<string, IssueCycle>()
  private readonly views = new Map<string, IssueView>()
  private readonly asyncBoundary = Promise.resolve()

  async listProjects(): Promise<IssueProject[]> {
    await this.asyncBoundary

    return [...this.projects.values()]
      .sort((left, right) => left.slug.localeCompare(right.slug))
      .map((project) => ({ ...project }))
  }

  async findProjectBySlug(projectSlug: string): Promise<IssueProject | null> {
    await this.asyncBoundary

    const project = this.projects.get(projectSlug)

    return project ? { ...project } : null
  }

  async createProject(project: NewProjectRecord): Promise<IssueProject> {
    await this.asyncBoundary

    const record = { ...project }
    this.projects.set(project.slug, record)

    return { ...record }
  }

  async listProjectMilestones(
    projectSlug: string
  ): Promise<IssueProjectMilestone[]> {
    await this.asyncBoundary

    return [...this.milestones.values()]
      .filter((milestone) => milestone.project_slug === projectSlug)
      .sort((left, right) => left.position - right.position)
      .map((milestone) => ({ ...milestone }))
  }

  async createProjectMilestone(
    milestone: NewProjectMilestoneRecord
  ): Promise<IssueProjectMilestone | null> {
    await this.asyncBoundary

    if (!this.projects.has(milestone.project_slug)) {
      return null
    }

    const record = { ...milestone }
    this.milestones.set(record.id, record)

    return { ...record }
  }

  async listCycles(teamKey: string): Promise<IssueCycle[]> {
    await this.asyncBoundary

    return [...this.cycles.values()]
      .filter((cycle) => cycle.team_key === teamKey)
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at))
      .map((cycle) => ({ ...cycle }))
  }

  async createCycle(cycle: NewCycleRecord): Promise<IssueCycle | null> {
    await this.asyncBoundary

    if (!this.teams.has(cycle.team_key)) {
      return null
    }

    const record = { ...cycle }
    this.cycles.set(record.id, record)

    return { ...record }
  }

  async listIssueViews(projectSlug: string): Promise<IssueView[]> {
    await this.asyncBoundary

    return [...this.views.values()]
      .filter((view) => view.project_slug === projectSlug)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((view) => cloneIssueView(view))
  }

  async findIssueViewById(viewId: string): Promise<IssueView | null> {
    await this.asyncBoundary

    const view = this.views.get(viewId)

    return view ? cloneIssueView(view) : null
  }

  async createIssueView(view: NewIssueViewRecord): Promise<IssueView | null> {
    await this.asyncBoundary

    if (!this.projects.has(view.project_slug)) {
      return null
    }

    this.views.set(view.id, cloneIssueView(view))

    return cloneIssueView(view)
  }

  async updateIssueView(
    viewId: string,
    patch: IssueViewUpdatePatch,
    updatedAt: string
  ): Promise<IssueView | null> {
    await this.asyncBoundary

    const view = this.views.get(viewId)

    if (!view) {
      return null
    }

    if (patch.name !== undefined) {
      view.name = patch.name
    }
    if (patch.filters !== undefined) {
      view.filters = cloneIssueViewFilters(patch.filters)
    }
    if (patch.display_options !== undefined) {
      view.display_options = { ...patch.display_options }
    }
    view.updated_at = updatedAt

    return cloneIssueView(view)
  }

  async deleteIssueView(viewId: string): Promise<boolean> {
    await this.asyncBoundary

    return this.views.delete(viewId)
  }

  async listTeams(): Promise<IssueTeam[]> {
    await this.asyncBoundary

    return [...this.teams.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((team) => cloneTeam(team))
  }

  async findTeamByKey(teamKey: string): Promise<IssueTeam | null> {
    await this.asyncBoundary

    const team = this.teams.get(teamKey)

    return team ? cloneTeam(team) : null
  }

  async createTeam(
    team: NewTeamRecord,
    states: NewWorkflowStateRecord[]
  ): Promise<IssueTeam> {
    await this.asyncBoundary

    const record: IssueTeam = {
      ...team,
      workflow_states: states.map((state) => ({ ...state })),
    }
    this.teams.set(team.key, cloneTeam(record))

    return cloneTeam(record)
  }

  async listWorkflowStates(teamKey: string): Promise<IssueWorkflowState[]> {
    await this.asyncBoundary

    return (
      this.teams
        .get(teamKey)
        ?.workflow_states.map((state) => ({ ...state }))
        .sort((left, right) => left.position - right.position) ?? []
    )
  }

  async replaceWorkflowStates(
    teamKey: string,
    states: NewWorkflowStateRecord[],
    updatedAt: string
  ): Promise<IssueWorkflowState[] | null> {
    await this.asyncBoundary

    const team = this.teams.get(teamKey)

    if (!team) {
      return null
    }

    team.workflow_states = states.map((state) => ({ ...state }))
    team.updated_at = updatedAt

    return team.workflow_states.map((state) => ({ ...state }))
  }

  async searchIssues(params: {
    project: string
    states: string[]
    assignee: string | null
  }): Promise<IssueRecord[]> {
    await this.asyncBoundary

    return [...this.issues.values()]
      .filter((issue) => issue.project === params.project)
      .filter((issue) =>
        params.states.some((state) => sameState(issue.state, state))
      )
      .filter(
        (issue) =>
          params.assignee === null || issue.assignee === params.assignee
      )
      .map((issue) => cloneIssue(issue))
  }

  async findIssuesByIds(ids: string[]): Promise<IssueRecord[]> {
    await this.asyncBoundary

    return ids
      .map((id) => this.issues.get(id))
      .filter((issue): issue is IssueRecord => issue !== undefined)
      .map((issue) => cloneIssue(issue))
  }

  async findIssueById(issueId: string): Promise<IssueRecord | null> {
    await this.asyncBoundary

    const issue = this.issues.get(issueId)

    return issue ? cloneIssue(issue) : null
  }

  async issueExists(issueId: string): Promise<boolean> {
    await this.asyncBoundary

    return this.issues.has(issueId)
  }

  async createIssue(issue: NewIssueRecord): Promise<IssueRecord> {
    await this.asyncBoundary

    const record: IssueRecord = {
      ...issue,
      identifier: this.nextIdentifier(issue.project),
      comments: [],
      links: [],
      relations: [],
    }

    this.issues.set(record.id, cloneIssue(record))

    return cloneIssue(record)
  }

  async updateIssue(
    issueId: string,
    patch: IssueUpdatePatch,
    updatedAt: string
  ): Promise<IssueRecord | null> {
    await this.asyncBoundary

    const issue = this.issues.get(issueId)

    if (!issue) {
      return null
    }

    if (patch.title !== undefined) {
      issue.title = patch.title
    }
    if (patch.description !== undefined) {
      issue.description = patch.description
    }
    if (patch.priority !== undefined) {
      issue.priority = patch.priority
    }
    if (patch.state !== undefined) {
      issue.state = patch.state
    }
    if (patch.branch_name !== undefined) {
      issue.branch_name = patch.branch_name
    }
    if (patch.url !== undefined) {
      issue.url = patch.url
    }
    if (patch.labels !== undefined) {
      issue.labels = [...patch.labels]
    }
    if (patch.blocked_by_ids !== undefined) {
      issue.blocked_by_ids = [...patch.blocked_by_ids]
    }
    if (patch.external_blockers !== undefined) {
      issue.external_blockers = patch.external_blockers.map((blocker) => ({
        ...blocker,
      }))
    }
    if (patch.assignee !== undefined) {
      issue.assignee = patch.assignee
    }
    if (patch.milestone_id !== undefined) {
      if (patch.milestone_id && !this.milestones.has(patch.milestone_id)) {
        return null
      }
      issue.milestone_id = patch.milestone_id
    }
    if (patch.cycle_id !== undefined) {
      if (patch.cycle_id && !this.cycles.has(patch.cycle_id)) {
        return null
      }
      issue.cycle_id = patch.cycle_id
    }
    issue.updated_at = updatedAt

    return cloneIssue(issue)
  }

  async updateIssueState(
    issueId: string,
    state: string,
    updatedAt: string
  ): Promise<IssueRecord | null> {
    await this.asyncBoundary

    const issue = this.issues.get(issueId)

    if (!issue) {
      return null
    }

    issue.state = state
    issue.updated_at = updatedAt

    return cloneIssue(issue)
  }

  async createComment(
    issueId: string,
    comment: IssueComment,
    updatedAt: string
  ): Promise<IssueComment | null> {
    await this.asyncBoundary

    const issue = this.issues.get(issueId)

    if (!issue) {
      return null
    }

    issue.comments.push({ ...comment })
    issue.updated_at = updatedAt

    return { ...comment }
  }

  async updateComment(
    commentId: string,
    body: string,
    updatedAt: string
  ): Promise<IssueComment | null> {
    await this.asyncBoundary

    const match = this.findComment(commentId)

    if (!match) {
      return null
    }

    match.comment.body = body
    match.comment.updated_at = updatedAt
    match.issue.updated_at = updatedAt

    return { ...match.comment }
  }

  async deactivateComment(
    commentId: string,
    updatedAt: string
  ): Promise<IssueComment | null> {
    await this.asyncBoundary

    const match = this.findComment(commentId)

    if (!match) {
      return null
    }

    match.comment.resolved = true
    match.comment.updated_at = updatedAt
    match.issue.updated_at = updatedAt

    return { ...match.comment }
  }

  async attachLink(
    issueId: string,
    link: IssueLink,
    updatedAt: string
  ): Promise<IssueLink | null> {
    await this.asyncBoundary

    const issue = this.issues.get(issueId)

    if (!issue) {
      return null
    }

    issue.links.push({ ...link })
    issue.updated_at = updatedAt

    return { ...link }
  }

  async createRelation(
    relation: IssueRelation,
    updatedAt: string
  ): Promise<IssueRelation | null> {
    await this.asyncBoundary

    const source = this.issues.get(relation.source_issue_id)
    const target = this.issues.get(relation.target_issue_id)

    if (!source || !target) {
      return null
    }

    source.relations.push({ ...relation })

    if (
      relation.relation_type === "blocked_by" &&
      !source.blocked_by_ids.includes(target.id)
    ) {
      source.blocked_by_ids.push(target.id)
    }

    source.updated_at = updatedAt

    return { ...relation }
  }

  private findComment(
    commentId: string
  ): { issue: IssueRecord; comment: IssueComment } | null {
    for (const issue of this.issues.values()) {
      const comment = issue.comments.find((item) => item.id === commentId)

      if (comment) {
        return { issue, comment }
      }
    }

    return null
  }

  private nextIdentifier(project: string): string {
    const prefix = issueIdentifierPrefix(project)
    const next = (this.issueCounters.get(prefix) ?? 0) + 1
    this.issueCounters.set(prefix, next)

    return `${prefix}-${next}`
  }
}

function cloneTeam(team: IssueTeam): IssueTeam {
  return {
    ...team,
    workflow_states: team.workflow_states.map((state) => ({ ...state })),
  }
}

function cloneIssueViewFilters(filters: IssueView["filters"]) {
  return {
    ...filters,
    states: [...filters.states],
    labels: [...filters.labels],
  }
}

function cloneIssueView(view: IssueView): IssueView {
  return {
    ...view,
    filters: cloneIssueViewFilters(view.filters),
    display_options: { ...view.display_options },
  }
}

function cloneIssue(issue: IssueRecord): IssueRecord {
  return {
    ...issue,
    labels: [...issue.labels],
    blocked_by_ids: [...issue.blocked_by_ids],
    external_blockers: issue.external_blockers.map((blocker) => ({
      ...blocker,
    })),
    comments: issue.comments.map((comment) => ({ ...comment })),
    links: issue.links.map((link) => ({ ...link })),
    relations: issue.relations.map((relation) => ({ ...relation })),
  }
}
