"use client"

import * as React from "react"
import { FolderOpen, History } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@workspace/ui/components/button"

type ProjectScopePickerProps = {
  currentProject: string
}

const RECENT_PROJECTS_KEY = "radial.recentProjects"

function readRecentProjects() {
  try {
    const value = window.localStorage.getItem(RECENT_PROJECTS_KEY)
    if (!value) {
      return []
    }

    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (project): project is string =>
        typeof project === "string" && project.trim().length > 0
    )
  } catch {
    return []
  }
}

function rememberProject(project: string, recentProjects: string[]) {
  return [
    project,
    ...recentProjects.filter((recentProject) => recentProject !== project),
  ].slice(0, 5)
}

function ProjectScopePicker({ currentProject }: ProjectScopePickerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [project, setProject] = React.useState(currentProject)
  const [recentProjects, setRecentProjects] = React.useState<string[]>([])

  React.useEffect(() => {
    setRecentProjects(readRecentProjects())
  }, [])

  React.useEffect(() => {
    setProject(currentProject)
  }, [currentProject])

  const openProject = React.useCallback(
    (nextProject: string) => {
      const trimmedProject = nextProject.trim()
      if (!trimmedProject) {
        return
      }

      setProject(trimmedProject)
      setRecentProjects((currentRecentProjects) => {
        const nextRecentProjects = rememberProject(
          trimmedProject,
          currentRecentProjects
        )
        window.localStorage.setItem(
          RECENT_PROJECTS_KEY,
          JSON.stringify(nextRecentProjects)
        )
        return nextRecentProjects
      })

      const params = new URLSearchParams(searchParams.toString())
      params.set("project", trimmedProject)
      router.replace(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        openProject(project)
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="project-scope">
          Project
        </label>
        <div className="flex gap-2">
          <input
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            id="project-scope"
            name="project"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          />
          <Button type="submit">
            <FolderOpen data-icon="inline-start" />
            Open project
          </Button>
        </div>
      </div>
      {recentProjects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <History className="text-muted-foreground" aria-hidden="true" />
          {recentProjects.map((recentProject) => (
            <Button
              key={recentProject}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openProject(recentProject)}
            >
              {recentProject}
            </Button>
          ))}
        </div>
      ) : null}
    </form>
  )
}

export { ProjectScopePicker }
