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
  assignee?: string | null
  milestone_id?: string | null
  cycle_id?: string | null
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

export interface CurrentUser {
  id: string
  name: string
  email: string | null
}

type SearchIssueStateFilter =
  | { active_states: readonly string[]; states?: readonly string[] }
  | { active_states?: readonly string[]; states: readonly string[] }

export type SearchIssuesBody = SearchIssueStateFilter & {
  project: string
  assignee?: string
}

export interface CreateIssueBody {
  project: string
  title: string
  description?: string
  state?: string
  state_name?: string
  branch_name?: string
  url?: string
  priority?: number | null
  labels?: string[]
  assignee?: string
  blocked_by?: Array<string | IssueBlocker>
}

export interface UpdateIssueBody {
  title?: string
  description?: string | null
  state?: string
  state_name?: string
  branch_name?: string | null
  url?: string | null
  priority?: number | null
  labels?: string[]
  assignee?: string | null
  milestone_id?: string | null
  cycle_id?: string | null
  blocked_by?: Array<string | IssueBlocker>
}

export interface CreateIssueViewBody {
  name: string
  filters?: Partial<IssueViewFilters>
  display_options?: Partial<IssueViewDisplayOptions>
}

export interface UpdateIssueViewBody {
  name?: string
  filters?: Partial<IssueViewFilters>
  display_options?: Partial<IssueViewDisplayOptions>
}
