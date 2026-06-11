export type ErrorCategory =
  | "missing_tracker_api_key"
  | "missing_tracker_project_slug"
  | "tracker_auth_failed"
  | "tracker_forbidden"
  | "tracker_not_found"
  | "tracker_rate_limited"
  | "tracker_request_failed"
  | "tracker_bad_status"
  | "tracker_decode_error"
  | "tracker_unknown_payload"
  | "tracker_missing_page_cursor"
  | "tracker_comment_not_found"
  | "tracker_comment_update_failed"
  | "tracker_comment_deactivate_failed"
  | "tracker_invalid_state_transition"
  | "tracker_state_not_found"
  | "tracker_link_attach_failed"
  | "tracker_issue_create_failed"
  | "tracker_relation_create_failed"

export type RelationType = "related" | "blocked_by"
export type WorkflowStateType =
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled"
export type ProjectStatus =
  | "backlog"
  | "planned"
  | "in_progress"
  | "completed"
  | "canceled"
export type IssueViewLayout = "kanban" | "list"
export type IssueViewGroupBy = "state" | "assignee" | "priority"
export type IssueViewSortBy =
  | "created_at"
  | "updated_at"
  | "priority"
  | "identifier"

export interface TrackerErrorBody {
  error: {
    category: ErrorCategory
    message: string
  }
}

export interface IssueBlocker {
  id: string
  identifier: string
  state: string | null
}

export interface NormalizedIssue {
  id: string
  identifier: string
  title: string
  description: string | null
  priority: number | null
  state: string
  branch_name: string | null
  url: string | null
  assignee: string | null
  milestone_id: string | null
  cycle_id: string | null
  labels: string[]
  blocked_by: IssueBlocker[]
  created_at: string | null
  updated_at: string | null
}

export interface IssueComment {
  id: string
  issue_id: string
  body: string
  resolved: boolean
  created_at: string
  updated_at: string
}

export interface IssueLink {
  id: string
  issue_id: string
  url: string
  title: string | null
  type: string | null
  created_at: string
}

export interface IssueRelation {
  id: string
  source_issue_id: string
  relation_type: RelationType
  target_issue_id: string
  created_at: string
}

export interface IssueWorkflowState {
  id: string
  team_key: string
  name: string
  type: WorkflowStateType
  position: number
  created_at: string
  updated_at: string
}

export interface IssueTeam {
  key: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  workflow_states: IssueWorkflowState[]
}

export interface IssueProject {
  slug: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface IssueProjectMilestone {
  id: string
  project_slug: string
  name: string
  description: string | null
  target_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface IssueCycle {
  id: string
  team_key: string
  name: string
  starts_at: string
  ends_at: string
  created_at: string
  updated_at: string
}

export interface IssueViewFilters {
  query: string | null
  states: string[]
  assignee: string | null
  labels: string[]
}

export interface IssueViewDisplayOptions {
  layout: IssueViewLayout
  group_by: IssueViewGroupBy
  sort_by: IssueViewSortBy
  show_empty_states: boolean
}

export interface IssueView {
  id: string
  project_slug: string
  name: string
  filters: IssueViewFilters
  display_options: IssueViewDisplayOptions
  created_at: string
  updated_at: string
}

export interface IssueDetail extends NormalizedIssue {
  project: string
  comments: IssueComment[]
  links: IssueLink[]
  relations: IssueRelation[]
}

export interface IssueRecord {
  id: string
  identifier: string
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
  comments: IssueComment[]
  links: IssueLink[]
  relations: IssueRelation[]
}
