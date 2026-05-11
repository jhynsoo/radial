"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  parseCommentBody,
  parseIssueForm,
  parseLinkForm,
  parseRelationForm,
} from "@/lib/issues/forms"
import {
  attachLink,
  createComment,
  createIssue,
  createRelation,
  deactivateComment,
  updateComment,
  updateIssueState,
} from "@/lib/tracker/client"
import type { WorkflowState } from "@/lib/tracker/constants"

export async function updateIssueStateAction(
  issueId: string,
  state: WorkflowState,
) {
  await updateIssueState(issueId, state)
  revalidatePath("/")
  revalidatePath(`/issues/${issueId}`)
}

export async function createIssueAction(formData: FormData) {
  const issue = await createIssue(parseIssueForm(formData))
  revalidatePath("/")
  redirect(`/issues/${issue.id}`)
}

export async function createCommentAction(issueId: string, formData: FormData) {
  await createComment(issueId, parseCommentBody(formData))
  revalidatePath(`/issues/${issueId}`)
}

export async function updateCommentAction(
  issueId: string,
  commentId: string,
  formData: FormData,
) {
  await updateComment(commentId, parseCommentBody(formData))
  revalidatePath(`/issues/${issueId}`)
}

export async function deactivateCommentAction(
  issueId: string,
  commentId: string,
) {
  await deactivateComment(commentId)
  revalidatePath(`/issues/${issueId}`)
}

export async function attachLinkAction(issueId: string, formData: FormData) {
  await attachLink(issueId, parseLinkForm(formData))
  revalidatePath(`/issues/${issueId}`)
}

export async function createRelationAction(
  issueId: string,
  formData: FormData,
) {
  await createRelation(issueId, parseRelationForm(formData))
  revalidatePath(`/issues/${issueId}`)
}
