"use client"

import type { ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"

export function ConfirmSubmitButton({
  children,
  message,
  formAction,
}: {
  children: ReactNode
  message: string
  formAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <Button
      formAction={formAction}
      type="submit"
      variant="destructive"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault()
        }
      }}
    >
      {children}
    </Button>
  )
}
