import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { unauthorized } from "./tracker-errors"

interface AuthenticatedRequest {
  headers: {
    authorization?: string
  }
}

@Injectable()
export class TrackerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.TRACKER_API_KEY?.trim()

    if (!expectedToken) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorization = request.headers.authorization?.trim()

    if (authorization === `Bearer ${expectedToken}`) {
      return true
    }

    unauthorized(
      "tracker_auth_failed",
      "Authorization header must contain a valid bearer token."
    )
  }
}
