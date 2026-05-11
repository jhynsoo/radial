import {
  attachLinkAction,
  createCommentAction,
  createRelationAction,
  deactivateCommentAction,
  updateCommentAction,
  updateIssueStateAction,
} from "@/app/issues/actions"
import { ConfirmSubmitButton } from "@/components/issues/confirm-submit-button"
import { WORKFLOW_STATES, type WorkflowState } from "@/lib/tracker/constants"
import type { IssueComment, IssueDetail } from "@/lib/tracker/types"
import { Button } from "@workspace/ui/components/button"

function isWorkflowState(
  value: FormDataEntryValue | null
): value is WorkflowState {
  return (
    typeof value === "string" &&
    WORKFLOW_STATES.some((state) => state === value)
  )
}

function fieldClassName(className = "") {
  return [
    "min-h-8 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  ]
    .filter(Boolean)
    .join(" ")
}

export function StateChangeForm({ issue }: { issue: IssueDetail }) {
  async function updateState(formData: FormData) {
    "use server"

    const state = formData.get("state")
    if (!isWorkflowState(state)) {
      throw new Error("State must be a known workflow state.")
    }

    await updateIssueStateAction(issue.id, state)
  }

  return (
    <form action={updateState} className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor="issue-state">
        State
      </label>
      <div className="flex gap-2">
        <select
          className={fieldClassName("w-full")}
          defaultValue={issue.state}
          id="issue-state"
          name="state"
        >
          {WORKFLOW_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Update
        </Button>
      </div>
    </form>
  )
}

export function CommentCreateForm({ issueId }: { issueId: string }) {
  return (
    <form
      action={createCommentAction.bind(null, issueId)}
      className="flex flex-col gap-2"
    >
      <label className="text-sm font-medium" htmlFor="new-comment-body">
        New comment
      </label>
      <textarea
        className={fieldClassName("min-h-24 resize-y")}
        id="new-comment-body"
        name="body"
        placeholder="Add an operational note"
        required
      />
      <Button className="self-start" type="submit">
        Add comment
      </Button>
    </form>
  )
}

export function CommentItem({
  issueId,
  comment,
}: {
  issueId: string
  comment: IssueComment
}) {
  return (
    <article className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{comment.id}</span>
        <span>
          {comment.resolved ? "Resolved" : "Active"} - Updated{" "}
          {new Date(comment.updated_at).toLocaleString()}
        </span>
      </div>
      <form
        action={updateCommentAction.bind(null, issueId, comment.id)}
        className="flex flex-col gap-2"
      >
        <label className="sr-only" htmlFor={`comment-body-${comment.id}`}>
          Comment body
        </label>
        <textarea
          className={fieldClassName("min-h-24 resize-y")}
          defaultValue={comment.body}
          id={`comment-body-${comment.id}`}
          name="body"
          required
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline">
            Save comment
          </Button>
          <ConfirmSubmitButton
            formAction={deactivateCommentAction.bind(null, issueId, comment.id)}
            message="Deactivate this comment?"
          >
            Deactivate
          </ConfirmSubmitButton>
        </div>
      </form>
    </article>
  )
}

export function LinkAttachForm({ issueId }: { issueId: string }) {
  return (
    <form
      action={attachLinkAction.bind(null, issueId)}
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className="text-sm font-medium" htmlFor="link-url">
          URL
        </label>
        <input
          className={fieldClassName()}
          id="link-url"
          name="url"
          placeholder="https://example.com"
          required
          type="url"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="link-title">
          Title
        </label>
        <input
          className={fieldClassName()}
          id="link-title"
          name="title"
          placeholder="Spec or PR"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="link-type">
          Type
        </label>
        <input
          className={fieldClassName()}
          id="link-type"
          name="type"
          placeholder="doc"
        />
      </div>
      <Button className="self-end" type="submit">
        Attach
      </Button>
    </form>
  )
}

export function RelationCreateForm({ issueId }: { issueId: string }) {
  return (
    <form
      action={createRelationAction.bind(null, issueId)}
      className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="relation-type">
          Relation type
        </label>
        <select
          className={fieldClassName()}
          defaultValue="related"
          id="relation-type"
          name="relation_type"
        >
          <option value="related">related</option>
          <option value="blocked_by">blocked_by</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="target-issue-id">
          Target issue ID
        </label>
        <input
          className={fieldClassName()}
          id="target-issue-id"
          name="target_issue_id"
          required
        />
      </div>
      <Button className="self-end" type="submit">
        Add relation
      </Button>
    </form>
  )
}
