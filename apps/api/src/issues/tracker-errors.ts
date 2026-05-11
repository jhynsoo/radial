import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { ErrorCategory, TrackerErrorBody } from "./issue.types"

export function trackerError(
  category: ErrorCategory,
  message: string
): TrackerErrorBody {
  return {
    error: {
      category,
      message,
    },
  }
}

export function badRequest(category: ErrorCategory, message: string): never {
  throw new BadRequestException(trackerError(category, message))
}

export function notFound(category: ErrorCategory, message: string): never {
  throw new NotFoundException(trackerError(category, message))
}

export function unauthorized(category: ErrorCategory, message: string): never {
  throw new UnauthorizedException(trackerError(category, message))
}
