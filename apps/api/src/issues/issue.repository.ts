import {
  IssueBlocker,
  IssueComment,
  IssueLink,
  IssueRecord,
  IssueRelation,
  IssueTeam,
  IssueCycle,
  IssueProject,
  IssueProjectMilestone,
  IssueView,
  IssueViewDisplayOptions,
  IssueViewFilters,
  IssueWorkflowState,
  ProjectStatus,
  WorkflowStateType,
} from "./issue.types"

export const ISSUE_REPOSITORY = Symbol("ISSUE_REPOSITORY")

export interface NewIssueRecord {
  id: string
  project: string
  title: string
  description: string | null
  priority: number | null
  state: string
  branch_name: string | null
  url: string | null
  labels: string[]
  blocked_by_ids: string[]
  external_blockers: IssueBlocker[]
  assignee: string | null
  milestone_id: string | null
  cycle_id: string | null
  created_at: string
  updated_at: string
}

export interface NewTeamRecord {
  key: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface NewWorkflowStateRecord {
  id: string
  team_key: string
  name: string
  type: WorkflowStateType
  position: number
  created_at: string
  updated_at: string
}

export interface NewProjectRecord {
  slug: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface NewProjectMilestoneRecord {
  id: string
  project_slug: string
  name: string
  description: string | null
  target_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface NewCycleRecord {
  id: string
  team_key: string
  name: string
  starts_at: string
  ends_at: string
  created_at: string
  updated_at: string
}

export interface NewIssueViewRecord {
  id: string
  project_slug: string
  name: string
  filters: IssueViewFilters
  display_options: IssueViewDisplayOptions
  created_at: string
  updated_at: string
}

export interface IssueUpdatePatch {
  title?: string
  description?: string | null
  priority?: number | null
  state?: string
  branch_name?: string | null
  url?: string | null
  labels?: string[]
  blocked_by_ids?: string[]
  external_blockers?: IssueBlocker[]
  assignee?: string | null
  milestone_id?: string | null
  cycle_id?: string | null
}

export interface IssueViewUpdatePatch {
  name?: string
  filters?: IssueViewFilters
  display_options?: IssueViewDisplayOptions
}

export interface IssueRepository {
  listProjects(): Promise<IssueProject[]>
  findProjectBySlug(projectSlug: string): Promise<IssueProject | null>
  createProject(project: NewProjectRecord): Promise<IssueProject>
  listProjectMilestones(projectSlug: string): Promise<IssueProjectMilestone[]>
  createProjectMilestone(
    milestone: NewProjectMilestoneRecord
  ): Promise<IssueProjectMilestone | null>
  listCycles(teamKey: string): Promise<IssueCycle[]>
  createCycle(cycle: NewCycleRecord): Promise<IssueCycle | null>
  listIssueViews(projectSlug: string): Promise<IssueView[]>
  findIssueViewById(viewId: string): Promise<IssueView | null>
  createIssueView(view: NewIssueViewRecord): Promise<IssueView | null>
  updateIssueView(
    viewId: string,
    patch: IssueViewUpdatePatch,
    updatedAt: string
  ): Promise<IssueView | null>
  deleteIssueView(viewId: string): Promise<boolean>
  listTeams(): Promise<IssueTeam[]>
  findTeamByKey(teamKey: string): Promise<IssueTeam | null>
  createTeam(
    team: NewTeamRecord,
    states: NewWorkflowStateRecord[]
  ): Promise<IssueTeam>
  listWorkflowStates(teamKey: string): Promise<IssueWorkflowState[]>
  replaceWorkflowStates(
    teamKey: string,
    states: NewWorkflowStateRecord[],
    updatedAt: string
  ): Promise<IssueWorkflowState[] | null>
  searchIssues(params: {
    project: string
    states: string[]
    assignee: string | null
  }): Promise<IssueRecord[]>
  findIssuesByIds(ids: string[]): Promise<IssueRecord[]>
  findIssueById(issueId: string): Promise<IssueRecord | null>
  issueExists(issueId: string): Promise<boolean>
  createIssue(issue: NewIssueRecord): Promise<IssueRecord>
  updateIssue(
    issueId: string,
    patch: IssueUpdatePatch,
    updatedAt: string
  ): Promise<IssueRecord | null>
  updateIssueState(
    issueId: string,
    state: string,
    updatedAt: string
  ): Promise<IssueRecord | null>
  createComment(
    issueId: string,
    comment: IssueComment,
    updatedAt: string
  ): Promise<IssueComment | null>
  updateComment(
    commentId: string,
    body: string,
    updatedAt: string
  ): Promise<IssueComment | null>
  deactivateComment(
    commentId: string,
    updatedAt: string
  ): Promise<IssueComment | null>
  attachLink(
    issueId: string,
    link: IssueLink,
    updatedAt: string
  ): Promise<IssueLink | null>
  createRelation(
    relation: IssueRelation,
    updatedAt: string
  ): Promise<IssueRelation | null>
}

export function issueIdentifierPrefix(project: string): string {
  const prefix = project
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()

  return prefix.length > 0 ? prefix : "ISSUE"
}
