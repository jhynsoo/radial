import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { TrackerClientError, getIssue, searchIssues } from "./client"

const originalEnv = process.env

beforeEach(() => {
  vi.restoreAllMocks()
  process.env = {
    ...originalEnv,
    TRACKER_API_BASE_URL: "http://tracker.test/api/v1",
    TRACKER_API_KEY: "secret-token",
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe("tracker client", () => {
  it("searches issues with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      searchIssues({
        project: "radial",
        states: ["Todo"],
      }),
    ).resolves.toEqual([])

    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/search",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token",
        },
        body: JSON.stringify({ project: "radial", states: ["Todo"] }),
        cache: "no-store",
      }),
    )
  })

  it("normalizes backend error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            category: "tracker_not_found",
            message: "Issue missing.",
          },
        }),
      }),
    )

    await expect(getIssue("issue-1")).rejects.toMatchObject({
      category: "tracker_not_found",
      message: "Issue missing.",
      status: 404,
    })
  })

  it("uses a request-failed error when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    )

    await expect(getIssue("issue-1")).rejects.toBeInstanceOf(
      TrackerClientError,
    )
    await expect(getIssue("issue-1")).rejects.toMatchObject({
      category: "tracker_request_failed",
    })
  })
})
