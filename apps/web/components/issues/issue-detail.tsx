import Link from "next/link"

import {
  CommentCreateForm,
  CommentItem,
  LinkAttachForm,
  RelationCreateForm,
  StateChangeForm,
} from "@/components/issues/issue-mutation-forms"
import { safeExternalHref } from "@/lib/issues/links"
import { boardHref } from "@/lib/issues/navigation"
import type { IssueDetail } from "@/lib/tracker/types"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Unknown"
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  )
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function IssueLinkItem({
  link,
}: {
  link: IssueDetail["links"][number]
}) {
  const href = safeExternalHref(link.url)
  const className =
    "rounded-md border border-border bg-card p-3 text-sm text-card-foreground transition hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
  const content = (
    <>
      <span className="block font-medium">{link.title ?? link.url}</span>
      <span className="block truncate text-muted-foreground">
        {link.type ? `${link.type} - ` : ""}
        {link.url}
      </span>
    </>
  )

  if (!href) {
    return <div className={className}>{content}</div>
  }

  return (
    <a
      className={className}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  )
}

export function IssueDetailView({ issue }: { issue: IssueDetail }) {
  const blockerCount = issue.blocked_by.length
  const sourceHref = safeExternalHref(issue.url)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "h-7")}
            href={boardHref(issue.project)}
          >
            Back to board
          </Link>
          {sourceHref ? (
            <a
              className={cn(buttonVariants({ variant: "outline" }), "h-7")}
              href={sourceHref}
              rel="noreferrer"
              target="_blank"
            >
              Source issue
            </a>
          ) : issue.url ? (
            <span className="max-w-full truncate text-xs text-muted-foreground">
              Source: {issue.url}
            </span>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <header className="flex flex-col gap-2 border-b border-border pb-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono font-medium">
                  {issue.identifier}
                </span>
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                  {issue.state}
                </span>
              </div>
              <h1 className="text-2xl leading-tight font-semibold tracking-normal">
                {issue.title}
              </h1>
            </header>

            <Section title="Description">
              {issue.description ? (
                <p className="rounded-md border border-border bg-card p-3 text-sm leading-6 whitespace-pre-wrap text-card-foreground">
                  {issue.description}
                </p>
              ) : (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No description.
                </p>
              )}
            </Section>

            <Section title={`Comments (${issue.comments.length})`}>
              <CommentCreateForm issueId={issue.id} />
              <div className="flex flex-col gap-2">
                {issue.comments.length > 0 ? (
                  issue.comments.map((comment) => (
                    <CommentItem
                      comment={comment}
                      issueId={issue.id}
                      key={comment.id}
                    />
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No comments.
                  </p>
                )}
              </div>
            </Section>

            <Section title={`Links (${issue.links.length})`}>
              <LinkAttachForm issueId={issue.id} />
              <div className="flex flex-col gap-2">
                {issue.links.length > 0 ? (
                  issue.links.map((link) => (
                    <IssueLinkItem key={link.id} link={link} />
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No links.
                  </p>
                )}
              </div>
            </Section>

            <Section title={`Relations (${issue.relations.length})`}>
              <RelationCreateForm issueId={issue.id} />
              <div className="flex flex-col gap-2">
                {issue.relations.length > 0 ? (
                  issue.relations.map((relation) => (
                    <div
                      className="grid gap-2 rounded-md border border-border bg-card p-3 text-sm text-card-foreground sm:grid-cols-[10rem_1fr]"
                      key={relation.id}
                    >
                      <span className="font-mono text-muted-foreground">
                        {relation.relation_type}
                      </span>
                      <span className="font-mono">
                        {relation.target_issue_id}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No relations.
                  </p>
                )}
              </div>
            </Section>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-card-foreground">
              <h2 className="text-base font-semibold">Workflow</h2>
              <StateChangeForm issue={issue} />
            </section>

            <section className="rounded-md border border-border bg-card p-3 text-card-foreground">
              <h2 className="mb-2 text-base font-semibold">Metadata</h2>
              <dl>
                <MetaRow label="Project" value={issue.project} />
                <MetaRow
                  label="Priority"
                  value={
                    issue.priority === null ? "None" : `P${issue.priority}`
                  }
                />
                <MetaRow label="Branch" value={issue.branch_name ?? "None"} />
                <MetaRow
                  label="Labels"
                  value={
                    issue.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {issue.labels.map((label) => (
                          <span
                            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                            key={label}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "None"
                    )
                  }
                />
                <MetaRow label="Blockers" value={blockerCount} />
                <MetaRow label="Created" value={formatDate(issue.created_at)} />
                <MetaRow label="Updated" value={formatDate(issue.updated_at)} />
              </dl>
              {blockerCount > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Blocked by</h3>
                  {issue.blocked_by.map((blocker) => (
                    <div
                      className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-sm text-destructive"
                      key={blocker.id}
                    >
                      <span className="font-mono">{blocker.identifier}</span>
                      {blocker.state ? (
                        <span className="text-destructive/80">
                          {" "}
                          - {blocker.state}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
