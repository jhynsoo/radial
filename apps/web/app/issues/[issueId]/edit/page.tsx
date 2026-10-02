import { notFound } from "next/navigation"

import { updateIssueAction } from "@/app/issues/actions"
import { IssueForm } from "@/components/issues/issue-form"
import { loadConfiguredWorkflowStates } from "@/lib/issues/workflow-states"
import { getIssue, TrackerClientError } from "@/lib/tracker/client"

type SearchParamValue = string | string[] | undefined

type PageProps = {
  params: Promise<{ issueId: string }>
  searchParams?: Promise<{
    team?: SearchParamValue
  }>
}

function firstSearchParam(value: SearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

export default async function EditIssuePage({
  params,
  searchParams,
}: PageProps) {
  const { issueId } = await params
  const query = await searchParams
  const team = firstSearchParam(query?.team)
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
  const workflowStates = await loadConfiguredWorkflowStates(team)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4">
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="font-mono text-sm text-muted-foreground">
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
          workflowStates={workflowStates}
        />
      </div>
    </main>
  )
}
