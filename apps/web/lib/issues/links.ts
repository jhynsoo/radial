const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"])

export function safeExternalHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}
