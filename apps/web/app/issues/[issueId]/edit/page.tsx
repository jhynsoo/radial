import { notFound } from "next/navigation"

import { updateIssueAction } from "@/app/issues/actions"
import { IssueForm } from "@/components/issues/issue-form"
import { getIssue, TrackerClientError } from "@/lib/tracker/client"

type PageProps = {
  params: Promise<{ issueId: string }>
}

export default async function EditIssuePage({ params }: PageProps) {
  const { issueId } = await params
  const issue = await (async () => {
    try {
      return await getIssue(issueId)
    } catch (error) {
      if (
        error instanceof TrackerClientError &&
        error.category === "tracker_not_found"
      ) {
        notFound()
      }

      throw error
    }
  })()

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4">
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="text-sm font-mono text-muted-foreground">
            {issue.identifier} - {issue.project}
          </p>
          <h1 className="text-2xl leading-tight font-semibold tracking-normal">
            Edit issue
          </h1>
        </header>
        <IssueForm
          action={updateIssueAction.bind(null, issue.id)}
          cancelHref={`/issues/${issue.id}`}
          issue={issue}
          submitLabel="Save issue"
        />
      </div>
    </main>
  )
}
