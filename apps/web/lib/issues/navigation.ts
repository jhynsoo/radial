export function boardHref(project: string | null | undefined): string {
  const trimmedProject = project?.trim()
  if (!trimmedProject) {
    return "/"
  }

  const params = new URLSearchParams({ project: trimmedProject })
  return `/?${params.toString()}`
}
