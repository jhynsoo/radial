import { ExecutionContext, HttpException } from "@nestjs/common"
import { TrackerAuthGuard } from "./tracker-auth.guard"

describe("TrackerAuthGuard", () => {
  let originalApiKey: string | undefined
  let guard: TrackerAuthGuard

  beforeEach(() => {
    originalApiKey = process.env.TRACKER_API_KEY
    delete process.env.TRACKER_API_KEY
    guard = new TrackerAuthGuard()
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.TRACKER_API_KEY
      return
    }

    process.env.TRACKER_API_KEY = originalApiKey
  })

  it("allows requests when no API key is configured", () => {
    expect(guard.canActivate(contextWithAuthorization())).toBe(true)
  })

  it("allows requests with the expected bearer token", () => {
    process.env.TRACKER_API_KEY = " secret "

    expect(guard.canActivate(contextWithAuthorization("Bearer secret"))).toBe(
      true
    )
  })

  it("rejects requests with missing or invalid bearer tokens", () => {
    process.env.TRACKER_API_KEY = "secret"

    expectAuthError(() => guard.canActivate(contextWithAuthorization()))
    expectAuthError(() =>
      guard.canActivate(contextWithAuthorization("Bearer wrong"))
    )
    expectAuthError(() =>
      guard.canActivate(contextWithAuthorization("Basic secret"))
    )
  })
})

function contextWithAuthorization(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
      }),
    }),
  } as ExecutionContext
}

function expectAuthError(action: () => unknown): void {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getResponse()).toEqual({
      error: {
        category: "tracker_auth_failed",
        message: "Authorization header must contain a valid bearer token.",
      },
    })
    return
  }

  throw new Error("Expected tracker auth error to be thrown.")
}
