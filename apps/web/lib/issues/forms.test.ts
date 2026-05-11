import { describe, expect, it } from "vitest"
import {
  parseCommentBody,
  parseIssueForm,
  parseLinkForm,
  parseRelationForm,
} from "./forms"

describe("issue form parsing", () => {
  it("parses an issue form with labels, blockers, and assignee", () => {
    const formData = new FormData()
    formData.set("project", "radial")
    formData.set("title", "Create board")
    formData.set("description", "Build Kanban view")
    formData.set("state", "Todo")
    formData.set("priority", "2")
    formData.set("labels", "ui, api")
    formData.set("blocked_by", "issue-1, issue-2")
    formData.set("assignee", "me")
    formData.set("branch_name", "jo/rad-1-board")
    formData.set("url", "https://tracker.example/issues/RAD-1")

    expect(parseIssueForm(formData)).toEqual({
      project: "radial",
      title: "Create board",
      description: "Build Kanban view",
      state: "Todo",
      priority: 2,
      labels: ["ui", "api"],
      blocked_by: ["issue-1", "issue-2"],
      assignee: "me",
      branch_name: "jo/rad-1-board",
      url: "https://tracker.example/issues/RAD-1",
    })
  })

  it("rejects missing required values", () => {
    const formData = new FormData()
    expect(() => parseIssueForm(formData)).toThrow("Project is required.")
  })

  it("rejects non-integer priority", () => {
    const formData = new FormData()
    formData.set("project", "radial")
    formData.set("title", "Create board")
    formData.set("state", "Todo")
    formData.set("priority", "1.5")
    expect(() => parseIssueForm(formData)).toThrow(
      "Priority must be an integer."
    )
  })

  it("rejects exponent priority notation", () => {
    const formData = new FormData()
    formData.set("project", "radial")
    formData.set("title", "Create board")
    formData.set("state", "Todo")
    formData.set("priority", "1e3")
    expect(() => parseIssueForm(formData)).toThrow(
      "Priority must be an integer."
    )
  })

  it("rejects invalid issue URLs", () => {
    const formData = new FormData()
    formData.set("project", "radial")
    formData.set("title", "Create board")
    formData.set("state", "Todo")
    formData.set("url", "not-a-url")
    expect(() => parseIssueForm(formData)).toThrow("URL must be a valid URL.")
  })

  it("omits empty optional fields and includes empty priority as null", () => {
    const formData = new FormData()
    formData.set("project", "radial")
    formData.set("title", "Create board")
    formData.set("state", "Todo")
    formData.set("priority", "")
    formData.set("description", " ")
    formData.set("labels", " , ")
    formData.set("blocked_by", " , ")
    formData.set("assignee", " ")
    formData.set("branch_name", " ")
    formData.set("url", " ")

    expect(parseIssueForm(formData)).toEqual({
      project: "radial",
      title: "Create board",
      state: "Todo",
      priority: null,
    })
  })

  it("parses comment, link, and relation forms", () => {
    const comment = new FormData()
    comment.set("body", "Ready for review")
    expect(parseCommentBody(comment)).toBe("Ready for review")

    const link = new FormData()
    link.set("url", "https://example.com/pr/1")
    link.set("title", "Pull request")
    expect(parseLinkForm(link)).toEqual({
      url: "https://example.com/pr/1",
      title: "Pull request",
    })

    const relation = new FormData()
    relation.set("relation_type", "related")
    relation.set("target_issue_id", "issue-2")
    expect(parseRelationForm(relation)).toEqual({
      relation_type: "related",
      target_issue_id: "issue-2",
    })
  })

  it("rejects invalid links and relation types", () => {
    const link = new FormData()
    link.set("url", "not-a-url")
    expect(() => parseLinkForm(link)).toThrow("URL must be a valid URL.")

    const relation = new FormData()
    relation.set("relation_type", "duplicates")
    relation.set("target_issue_id", "issue-2")
    expect(() => parseRelationForm(relation)).toThrow(
      "Relation type must be related or blocked_by."
    )
  })

  it("rejects missing comment body", () => {
    expect(() => parseCommentBody(new FormData())).toThrow("Body is required.")
  })

  it("rejects missing link URL", () => {
    expect(() => parseLinkForm(new FormData())).toThrow("URL is required.")
  })

  it("rejects missing relation target issue ID", () => {
    const relation = new FormData()
    relation.set("relation_type", "related")
    expect(() => parseRelationForm(relation)).toThrow(
      "Target issue is required."
    )
  })
})
