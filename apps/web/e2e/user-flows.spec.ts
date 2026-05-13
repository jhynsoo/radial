import { expect, test, type Locator, type Page } from "@playwright/test"

const mockTrackerUrl = "http://127.0.0.1:3101"

test.beforeEach(async ({ page }) => {
  await page.request.post(`${mockTrackerUrl}/__test/reset`)
})

test("opens a project board, filters issues, and uses recent projects", async ({
  page,
}) => {
  await page.goto("/")

  await expect(
    page.getByText("Enter a project slug to load the issue board.")
  ).toBeVisible()

  await page.getByLabel("Project").fill("radial")
  await page.getByRole("button", { name: "Open project" }).click()

  await expect(page).toHaveURL(/project=radial/)
  await expect(page.getByRole("heading", { name: "Issue board" })).toBeVisible()
  await expect(page.getByText("4 issues")).toBeVisible()
  await expect(page.getByText("Fix API contract search")).toBeVisible()
  await expect(page.getByText("Orbit only task")).toBeHidden()

  await page.getByLabel("Search").fill("contract")
  await page.getByRole("button", { name: "Search" }).click()

  await expect(page).toHaveURL(/q=contract/)
  await expect(page.getByText("Filtered")).toBeVisible()
  await expect(page.getByText("Fix API contract search")).toBeVisible()
  await expect(page.getByText("Plan board-first issue console")).toBeHidden()

  await page.goto("/")
  await page.getByRole("button", { name: "radial" }).click()

  await expect(page).toHaveURL(/project=radial/)
  await expect(page.getByText("Fix API contract search")).toBeVisible()
})

test("creates an issue from the board and returns to the updated board", async ({
  page,
}) => {
  await page.goto("/?project=radial")
  await page.getByRole("link", { name: "New issue" }).click()

  await expect(page).toHaveURL(/\/issues\/new\?project=radial/)
  await expect(page.getByLabel("Project")).toHaveValue("radial")

  await page.getByLabel("Title").fill("Document e2e user flows")
  await page
    .getByLabel("Description")
    .fill("Cover the browser flows that users rely on.")
  await page.getByLabel("State").selectOption("Todo")
  await page.getByLabel("Priority").fill("2")
  await page.getByLabel("Labels").fill("test, web")
  await page.getByLabel("Branch").fill("codex/e2e-flows")
  await page.getByLabel("URL").fill("https://example.com/e2e-plan")
  await page.getByRole("button", { name: "Create issue" }).click()

  await expect(page).toHaveURL(/\/issues\/issue-6$/)
  await expect(page.getByRole("heading", { name: "Document e2e user flows" }))
    .toBeVisible()
  await expect(page.getByText("RAD-6")).toBeVisible()
  await expect(page.getByText("Cover the browser flows that users rely on."))
    .toBeVisible()
  await expect(page.getByText("P2")).toBeVisible()
  await expect(page.getByText("codex/e2e-flows")).toBeVisible()
  await expect(page.getByText("test")).toBeVisible()

  await page.getByRole("link", { name: "Back to board" }).click()

  await expect(page).toHaveURL(/project=radial/)
  await expect(page.getByText("5 issues")).toBeVisible()
  await expect(page.getByText("Document e2e user flows")).toBeVisible()
})

test("updates issue detail workflow, comments, links, and relations", async ({
  page,
}) => {
  await page.goto("/issues/issue-2")

  await expect(page.getByRole("heading", { name: "Fix API contract search" }))
    .toBeVisible()

  await page.getByLabel("State").selectOption("Human Review")
  await page.getByRole("button", { name: "Update" }).click()
  await expect(issueHeader(page)).toContainText("Human Review")

  await page.getByLabel("New comment").fill("Initial operational note")
  await page.getByRole("button", { name: "Add comment" }).click()
  await expect(page.getByRole("heading", { name: "Comments (1)" })).toBeVisible()
  await expect(page.getByLabel("Comment body")).toHaveValue(
    "Initial operational note"
  )

  await page.getByLabel("Comment body").fill("Updated operational note")
  await page.getByRole("button", { name: "Save comment" }).click()
  await expect(page.getByLabel("Comment body")).toHaveValue(
    "Updated operational note"
  )

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Deactivate this comment?")
    await dialog.dismiss()
  })
  await page.getByRole("button", { name: "Deactivate" }).click()
  await expect(page.getByLabel("Comment body")).toBeVisible()

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Deactivate this comment?")
    await dialog.accept()
  })
  await page.getByRole("button", { name: "Deactivate" }).click()
  await expect(page.getByRole("heading", { name: "Comments (0)" })).toBeVisible()
  await expect(page.getByText("No comments.")).toBeVisible()

  await page.getByLabel("URL").fill("https://example.com/spec")
  await page.getByLabel("Title").fill("Spec Link")
  await page.getByRole("textbox", { name: "Type" }).fill("doc")
  await page.getByRole("button", { name: "Attach" }).click()
  await expect(page.getByRole("heading", { name: "Links (1)" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Spec Link/ })).toHaveAttribute(
    "href",
    "https://example.com/spec"
  )

  await page.getByLabel("Relation type").selectOption("blocked_by")
  await page.getByLabel("Target issue ID").fill("issue-1")
  await page.getByRole("button", { name: "Add relation" }).click()
  await expect(page.getByRole("heading", { name: "Relations (1)" })).toBeVisible()
  const relationSection = detailSection(page, "Relations (1)")
  await expect(relationSection.locator("span", { hasText: "blocked_by" }))
    .toBeVisible()
  await expect(relationSection.locator("span", { hasText: "issue-1" }))
    .toBeVisible()
})

test("moves an issue between board columns with drag and drop", async ({
  page,
}) => {
  await page.goto("/?project=radial")

  const todoColumn = issueColumn(page, "Todo")
  const inProgressColumn = issueColumn(page, "In Progress")

  await expect(todoColumn.getByText("Fix API contract search")).toBeVisible()
  await expect(inProgressColumn.getByText("Fix API contract search")).toBeHidden()

  await page
    .getByRole("button", { name: "Drag issue RAD-2" })
    .dragTo(inProgressColumn)

  await expect(inProgressColumn.getByText("Fix API contract search"))
    .toBeVisible()
  await expect(todoColumn.getByText("Fix API contract search")).toBeHidden()

  await page.reload()

  await expect(inProgressColumn.getByText("Fix API contract search"))
    .toBeVisible()
})

function issueHeader(page: Page): Locator {
  return page.locator("header").filter({ hasText: "RAD-2" })
}

function issueColumn(page: Page, state: string): Locator {
  return page.getByRole("region", { name: `${state} issue column` })
}

function detailSection(page: Page, heading: string): Locator {
  return page.getByRole("heading", { name: heading }).locator("..")
}
