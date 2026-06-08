import { IssueTrackerController } from "./issue-tracker.controller"
import { IssueTrackerService } from "./issue-tracker.service"
import {
  IssueComment,
  IssueCycle,
  IssueDetail,
  IssueLink,
  IssueProject,
  IssueProjectMilestone,
  IssueRelation,
  IssueTeam,
  IssueView,
  NormalizedIssue,
} from "./issue.types"

describe("IssueTrackerController", () => {
  let controller: IssueTrackerController
  let issueTracker: IssueTrackerMock

  beforeEach(() => {
    issueTracker = {
      searchIssues: jest.fn(),
      listTeams: jest.fn(),
      createTeam: jest.fn(),
      listWorkflowStates: jest.fn(),
      replaceWorkflowStates: jest.fn(),
      listProjects: jest.fn(),
      createProject: jest.fn(),
      listProjectMilestones: jest.fn(),
      createProjectMilestone: jest.fn(),
      listCycles: jest.fn(),
      createCycle: jest.fn(),
      listIssueViews: jest.fn(),
      createIssueView: jest.fn(),
      updateIssueView: jest.fn(),
      deleteIssueView: jest.fn(),
      lookupIssues: jest.fn(),
      createIssue: jest.fn(),
      getIssue: jest.fn(),
      updateIssue: jest.fn(),
      listComments: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      deactivateComment: jest.fn(),
      listLinks: jest.fn(),
      attachLink: jest.fn(),
      createRelation: jest.fn(),
      getCurrentUser: jest.fn(),
    }

    controller = new IssueTrackerController(
      issueTracker as unknown as IssueTrackerService
    )
  })

  it("wraps issue read and write results", async () => {
    const issue = issueDetail()
    const normalizedIssue = normalized(issue)
    const searchPayload = { project: "radial", active_states: ["Todo"] }
    const lookupPayload = { ids: [issue.id] }
    const createPayload = { project: "radial", title: "Implement API" }
    const updatePayload = { state_name: "Done" }

    issueTracker.searchIssues.mockResolvedValue([normalizedIssue])
    issueTracker.lookupIssues.mockResolvedValue([normalizedIssue])
    issueTracker.createIssue.mockResolvedValue(issue)
    issueTracker.getIssue.mockResolvedValue(issue)
    issueTracker.updateIssue.mockResolvedValue({ ...issue, state: "Done" })

    await expect(controller.searchIssues(searchPayload)).resolves.toEqual({
      issues: [normalizedIssue],
    })
    expect(issueTracker.searchIssues).toHaveBeenCalledWith(searchPayload)

    await expect(controller.lookupIssues(lookupPayload)).resolves.toEqual({
      issues: [normalizedIssue],
    })
    expect(issueTracker.lookupIssues).toHaveBeenCalledWith(lookupPayload)

    await expect(controller.createIssue(createPayload)).resolves.toEqual({
      issue,
    })
    expect(issueTracker.createIssue).toHaveBeenCalledWith(createPayload)

    await expect(controller.getIssue(issue.id)).resolves.toEqual({ issue })
    expect(issueTracker.getIssue).toHaveBeenCalledWith(issue.id)

    await expect(
      controller.updateIssue(issue.id, updatePayload)
    ).resolves.toEqual({
      issue: { ...issue, state: "Done" },
    })
    expect(issueTracker.updateIssue).toHaveBeenCalledWith(
      issue.id,
      updatePayload
    )
  })

  it("wraps team and workflow state operations", async () => {
    const team = issueTeam()
    const states = team.workflow_states

    issueTracker.listTeams.mockResolvedValue([team])
    issueTracker.createTeam.mockResolvedValue(team)
    issueTracker.listWorkflowStates.mockResolvedValue(states)
    issueTracker.replaceWorkflowStates.mockResolvedValue(states)

    await expect(controller.listTeams()).resolves.toEqual({
      teams: [team],
    })
    expect(issueTracker.listTeams).toHaveBeenCalledTimes(1)

    await expect(
      controller.createTeam({ key: "RAD", name: "Radial" })
    ).resolves.toEqual({ team })
    expect(issueTracker.createTeam).toHaveBeenCalledWith({
      key: "RAD",
      name: "Radial",
    })

    await expect(controller.listWorkflowStates("RAD")).resolves.toEqual({
      states,
    })
    expect(issueTracker.listWorkflowStates).toHaveBeenCalledWith("RAD")

    await expect(
      controller.replaceWorkflowStates("RAD", { states: [] })
    ).resolves.toEqual({ states })
    expect(issueTracker.replaceWorkflowStates).toHaveBeenCalledWith("RAD", {
      states: [],
    })
  })

  it("wraps project, milestone, and cycle operations", async () => {
    const project = issueProject()
    const milestone = issueProjectMilestone()
    const cycle = issueCycle()
    const view = issueView()

    issueTracker.listProjects.mockResolvedValue([project])
    issueTracker.createProject.mockResolvedValue(project)
    issueTracker.listProjectMilestones.mockResolvedValue([milestone])
    issueTracker.createProjectMilestone.mockResolvedValue(milestone)
    issueTracker.listCycles.mockResolvedValue([cycle])
    issueTracker.createCycle.mockResolvedValue(cycle)
    issueTracker.listIssueViews.mockResolvedValue([view])
    issueTracker.createIssueView.mockResolvedValue(view)
    issueTracker.updateIssueView.mockResolvedValue({ ...view, name: "Mine" })
    issueTracker.deleteIssueView.mockResolvedValue(view)

    await expect(controller.listProjects()).resolves.toEqual({
      projects: [project],
    })
    expect(issueTracker.listProjects).toHaveBeenCalledTimes(1)

    await expect(
      controller.createProject({ slug: "radial-api", name: "Radial API" })
    ).resolves.toEqual({ project })
    expect(issueTracker.createProject).toHaveBeenCalledWith({
      slug: "radial-api",
      name: "Radial API",
    })

    await expect(
      controller.listProjectMilestones(project.slug)
    ).resolves.toEqual({
      milestones: [milestone],
    })
    expect(issueTracker.listProjectMilestones).toHaveBeenCalledWith(
      project.slug
    )

    await expect(
      controller.createProjectMilestone(project.slug, { name: "API parity" })
    ).resolves.toEqual({ milestone })
    expect(issueTracker.createProjectMilestone).toHaveBeenCalledWith(
      project.slug,
      { name: "API parity" }
    )

    await expect(controller.listCycles("RAD")).resolves.toEqual({
      cycles: [cycle],
    })
    expect(issueTracker.listCycles).toHaveBeenCalledWith("RAD")

    await expect(
      controller.createCycle("RAD", {
        name: "Sprint 1",
        starts_at: "2026-06-01T00:00:00.000Z",
        ends_at: "2026-06-14T00:00:00.000Z",
      })
    ).resolves.toEqual({ cycle })
    expect(issueTracker.createCycle).toHaveBeenCalledWith("RAD", {
      name: "Sprint 1",
      starts_at: "2026-06-01T00:00:00.000Z",
      ends_at: "2026-06-14T00:00:00.000Z",
    })

    await expect(controller.listIssueViews(project.slug)).resolves.toEqual({
      views: [view],
    })
    expect(issueTracker.listIssueViews).toHaveBeenCalledWith(project.slug)

    await expect(
      controller.createIssueView(project.slug, { name: "My work" })
    ).resolves.toEqual({ view })
    expect(issueTracker.createIssueView).toHaveBeenCalledWith(project.slug, {
      name: "My work",
    })

    await expect(
      controller.updateIssueView(view.id, { name: "Mine" })
    ).resolves.toEqual({ view: { ...view, name: "Mine" } })
    expect(issueTracker.updateIssueView).toHaveBeenCalledWith(view.id, {
      name: "Mine",
    })

    await expect(controller.deleteIssueView(view.id)).resolves.toEqual({
      view,
    })
    expect(issueTracker.deleteIssueView).toHaveBeenCalledWith(view.id)
  })

  it("wraps comment operations and parses include_resolved", async () => {
    const comment = issueComment()

    issueTracker.listComments.mockResolvedValue([comment])
    issueTracker.createComment.mockResolvedValue(comment)
    issueTracker.updateComment.mockResolvedValue({
      ...comment,
      body: "Updated",
    })
    issueTracker.deactivateComment.mockResolvedValue({
      ...comment,
      resolved: true,
    })

    await expect(controller.listComments("issue-1")).resolves.toEqual({
      comments: [comment],
    })
    expect(issueTracker.listComments).toHaveBeenLastCalledWith("issue-1", false)

    await expect(controller.listComments("issue-1", "true")).resolves.toEqual({
      comments: [comment],
    })
    expect(issueTracker.listComments).toHaveBeenLastCalledWith("issue-1", true)

    await expect(
      controller.createComment("issue-1", { body: "Note" })
    ).resolves.toEqual({
      comment,
    })
    expect(issueTracker.createComment).toHaveBeenCalledWith("issue-1", {
      body: "Note",
    })

    await expect(
      controller.updateComment(comment.id, { body: "Updated" })
    ).resolves.toEqual({
      comment: { ...comment, body: "Updated" },
    })
    expect(issueTracker.updateComment).toHaveBeenCalledWith(comment.id, {
      body: "Updated",
    })

    await expect(controller.deactivateComment(comment.id)).resolves.toEqual({
      comment: { ...comment, resolved: true },
    })
    expect(issueTracker.deactivateComment).toHaveBeenCalledWith(comment.id)
  })

  it("wraps links, relations, and current user", async () => {
    const link = issueLink()
    const relation = issueRelation()
    const user = {
      id: "me",
      name: "Radial API",
      email: null,
    }

    issueTracker.listLinks.mockResolvedValue([link])
    issueTracker.attachLink.mockResolvedValue(link)
    issueTracker.createRelation.mockResolvedValue(relation)
    issueTracker.getCurrentUser.mockReturnValue(user)

    await expect(controller.listLinks("issue-1")).resolves.toEqual({
      links: [link],
    })
    expect(issueTracker.listLinks).toHaveBeenCalledWith("issue-1")

    await expect(
      controller.attachLink("issue-1", { url: "https://example.com" })
    ).resolves.toEqual({ link })
    expect(issueTracker.attachLink).toHaveBeenCalledWith("issue-1", {
      url: "https://example.com",
    })

    await expect(
      controller.createRelation("issue-1", {
        relation_type: "related",
        target_issue_id: "issue-2",
      })
    ).resolves.toEqual({ relation })
    expect(issueTracker.createRelation).toHaveBeenCalledWith("issue-1", {
      relation_type: "related",
      target_issue_id: "issue-2",
    })

    expect(controller.getCurrentUser()).toEqual({ user })
    expect(issueTracker.getCurrentUser).toHaveBeenCalledTimes(1)
  })
})

function issueDetail(): IssueDetail {
  return {
    id: "issue-1",
    identifier: "RADIAL-1",
    project: "radial",
    title: "Implement API",
    description: "Details",
    priority: 1,
    state: "Todo",
    branch_name: "feature/api",
    url: "http://localhost:3001/api/v1/issues/issue-1",
    assignee: "me",
    milestone_id: null,
    cycle_id: null,
    labels: ["backend"],
    blocked_by: [],
    comments: [],
    links: [],
    relations: [],
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function normalized(issue: IssueDetail): NormalizedIssue {
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
    blocked_by: issue.blocked_by,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
  }
}

function issueTeam(): IssueTeam {
  return {
    key: "RAD",
    name: "Radial",
    description: null,
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
    workflow_states: [
      {
        id: "workflow-state-1",
        team_key: "RAD",
        name: "Todo",
        type: "unstarted",
        position: 0,
        created_at: "2026-05-12T00:00:00.000Z",
        updated_at: "2026-05-12T00:00:00.000Z",
      },
    ],
  }
}

function issueProject(): IssueProject {
  return {
    slug: "radial-api",
    name: "Radial API",
    description: null,
    status: "planned",
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueProjectMilestone(): IssueProjectMilestone {
  return {
    id: "project-milestone-1",
    project_slug: "radial-api",
    name: "API parity",
    description: null,
    target_date: null,
    position: 0,
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueCycle(): IssueCycle {
  return {
    id: "cycle-1",
    team_key: "RAD",
    name: "Sprint 1",
    starts_at: "2026-06-01T00:00:00.000Z",
    ends_at: "2026-06-14T00:00:00.000Z",
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueView(): IssueView {
  return {
    id: "issue-view-1",
    project_slug: "radial-api",
    name: "My work",
    filters: {
      query: "API",
      states: ["Todo"],
      assignee: "me",
      labels: ["backend"],
    },
    display_options: {
      layout: "kanban",
      group_by: "state",
      sort_by: "priority",
      show_empty_states: false,
    },
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueComment(): IssueComment {
  return {
    id: "comment-1",
    issue_id: "issue-1",
    body: "Initial note",
    resolved: false,
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueLink(): IssueLink {
  return {
    id: "link-1",
    issue_id: "issue-1",
    url: "https://example.com",
    title: "Example",
    type: "reference",
    created_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueRelation(): IssueRelation {
  return {
    id: "relation-1",
    source_issue_id: "issue-1",
    relation_type: "related",
    target_issue_id: "issue-2",
    created_at: "2026-05-12T00:00:00.000Z",
  }
}

interface IssueTrackerMock {
  searchIssues: jest.Mock
  listTeams: jest.Mock
  createTeam: jest.Mock
  listWorkflowStates: jest.Mock
  replaceWorkflowStates: jest.Mock
  listProjects: jest.Mock
  createProject: jest.Mock
  listProjectMilestones: jest.Mock
  createProjectMilestone: jest.Mock
  listCycles: jest.Mock
  createCycle: jest.Mock
  listIssueViews: jest.Mock
  createIssueView: jest.Mock
  updateIssueView: jest.Mock
  deleteIssueView: jest.Mock
  lookupIssues: jest.Mock
  createIssue: jest.Mock
  getIssue: jest.Mock
  updateIssue: jest.Mock
  listComments: jest.Mock
  createComment: jest.Mock
  updateComment: jest.Mock
  deactivateComment: jest.Mock
  listLinks: jest.Mock
  attachLink: jest.Mock
  createRelation: jest.Mock
  getCurrentUser: jest.Mock
}
