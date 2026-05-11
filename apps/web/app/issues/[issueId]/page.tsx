import { notFound } from "next/navigation"

import { IssueDetailView } from "@/components/issues/issue-detail"
import { getIssue, TrackerClientError } from "@/lib/tracker/client"

type PageProps = {
  params: Promise<{ issueId: string }>
}

export default async function IssuePage({ params }: PageProps) {
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

  return <IssueDetailView issue={issue} />
}
