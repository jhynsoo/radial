import { IssueForm } from "@/components/issues/issue-form"

type SearchParamValue = string | string[] | undefined

type PageProps = {
  searchParams?: Promise<{
    project?: SearchParamValue
  }>
}

function firstSearchParam(value: SearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

export default async function NewIssuePage({ searchParams }: PageProps) {
  const params = await searchParams
  const project = firstSearchParam(params?.project)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4">
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="text-sm font-mono text-muted-foreground">
            Issue intake
          </p>
          <h1 className="text-2xl leading-tight font-semibold tracking-normal">
            Create issue
          </h1>
        </header>
        <IssueForm defaultProject={project} />
      </div>
    </main>
  )
}
