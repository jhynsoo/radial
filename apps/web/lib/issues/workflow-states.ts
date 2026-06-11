import { listTeams, listWorkflowStates } from "../tracker/client"
import { WORKFLOW_STATES } from "../tracker/constants"
import { normalizeWorkflowStates } from "./board"

export async function loadConfiguredWorkflowStates(
  teamKey: string
): Promise<string[]> {
  try {
    const states = teamKey
      ? (await listWorkflowStates(teamKey)).map((state) => state.name)
      : (await listTeams()).flatMap((team) =>
          team.workflow_states.map((state) => state.name)
        )

    return normalizeWorkflowStates(states)
  } catch {
    return [...WORKFLOW_STATES]
  }
}
