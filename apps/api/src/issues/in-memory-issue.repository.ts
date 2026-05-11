import { Injectable } from "@nestjs/common"
import {
  IssueComment,
  IssueLink,
  IssueRecord,
  IssueRelation,
} from "./issue.types"
import {
  IssueRepository,
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
  private readonly asyncBoundary = Promise.resolve()

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
