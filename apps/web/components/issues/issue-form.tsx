import Link from "next/link"

import { createIssueAction } from "@/app/issues/actions"
import { boardHref } from "@/lib/issues/navigation"
import { WORKFLOW_STATES } from "@/lib/tracker/constants"
import type { IssueDetail } from "@/lib/tracker/types"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

function fieldClassName(className = "") {
  return [
    "min-h-8 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  ]
    .filter(Boolean)
    .join(" ")
}

function Field({
  children,
  description,
  id,
  label,
}: {
  children: React.ReactNode
  description?: string
  id: string
  label: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

type IssueFormProps = {
  action?: (formData: FormData) => void | Promise<void>
  cancelHref?: string
  defaultProject?: string
  issue?: IssueDetail
  submitLabel?: string
}

function blockerValue(issue?: IssueDetail): string {
  return issue?.blocked_by.map((blocker) => blocker.id).join(", ") ?? ""
}

export function IssueForm({
  action,
  cancelHref,
  defaultProject = "",
  issue,
  submitLabel = "Create issue",
}: IssueFormProps) {
  const project = issue?.project ?? defaultProject
  const formAction = action ?? createIssueAction
  const resolvedCancelHref = cancelHref ?? boardHref(project)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="grid gap-4 rounded-md border border-border bg-card p-4 text-card-foreground md:grid-cols-2">
        <Field id="issue-project" label="Project">
          <input
            autoComplete="off"
            className={fieldClassName()}
            defaultValue={project}
            id="issue-project"
            name="project"
            placeholder="radial"
            readOnly={Boolean(issue)}
            required
          />
        </Field>
        <Field id="issue-state" label="State">
          <select
            className={fieldClassName()}
            defaultValue={issue?.state ?? "Todo"}
            id="issue-state"
            name="state"
            required
          >
            {issue && !WORKFLOW_STATES.some((state) => state === issue.state) ? (
              <option value={issue.state}>{issue.state} (current)</option>
            ) : null}
            {WORKFLOW_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field id="issue-title" label="Title">
            <input
              className={fieldClassName("w-full")}
              defaultValue={issue?.title ?? ""}
              id="issue-title"
              name="title"
              placeholder="Short, actionable issue title"
              required
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field id="issue-description" label="Description">
            <textarea
              className={fieldClassName("min-h-36 w-full resize-y")}
              defaultValue={issue?.description ?? ""}
              id="issue-description"
              name="description"
              placeholder="Context, expected outcome, constraints, and useful links"
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-border bg-card p-4 text-card-foreground md:grid-cols-2">
        <Field id="issue-priority" label="Priority">
          <input
            className={fieldClassName()}
            defaultValue={issue?.priority ?? ""}
            id="issue-priority"
            inputMode="numeric"
            name="priority"
            placeholder="1"
            type="number"
          />
        </Field>
        <Field id="issue-assignee" label="Assignee">
          <input
            autoComplete="off"
            className={fieldClassName()}
            defaultValue={issue?.assignee ?? ""}
            id="issue-assignee"
            name="assignee"
            placeholder="agent or user id"
          />
        </Field>
        <Field
          description="Comma-separated label names."
          id="issue-labels"
          label="Labels"
        >
          <input
            className={fieldClassName()}
            defaultValue={issue?.labels.join(", ") ?? ""}
            id="issue-labels"
            name="labels"
            placeholder="api, urgent"
          />
        </Field>
        <Field
          description="Comma-separated issue IDs that block this issue."
          id="issue-blocked-by"
          label="Blocked by"
        >
          <input
            className={fieldClassName()}
            defaultValue={blockerValue(issue)}
            id="issue-blocked-by"
            name="blocked_by"
            placeholder="issue-id-1, issue-id-2"
          />
        </Field>
        <Field id="issue-branch" label="Branch">
          <input
            autoComplete="off"
            className={fieldClassName()}
            defaultValue={issue?.branch_name ?? ""}
            id="issue-branch"
            name="branch_name"
            placeholder="codex/new-workflow"
          />
        </Field>
        <Field id="issue-url" label="URL">
          <input
            className={fieldClassName()}
            defaultValue={issue?.url ?? ""}
            id="issue-url"
            name="url"
            placeholder="https://example.com/spec"
            type="url"
          />
        </Field>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          className={cn(buttonVariants({ variant: "outline" }))}
          href={resolvedCancelHref}
        >
          Cancel
        </Link>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}
