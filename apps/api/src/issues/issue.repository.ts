import {
  IssueBlocker,
  IssueComment,
  IssueLink,
  IssueRecord,
  IssueRelation,
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
  created_at: string
  updated_at: string
}

export interface IssueRepository {
  searchIssues(params: {
    project: string
    states: string[]
    assignee: string | null
  }): Promise<IssueRecord[]>
  findIssuesByIds(ids: string[]): Promise<IssueRecord[]>
  findIssueById(issueId: string): Promise<IssueRecord | null>
  issueExists(issueId: string): Promise<boolean>
  createIssue(issue: NewIssueRecord): Promise<IssueRecord>
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
