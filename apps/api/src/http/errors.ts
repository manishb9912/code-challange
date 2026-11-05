/** Transport-level rejections raised by HTTP hooks (not business errors). */
export class ForbiddenOriginError extends Error {
  readonly statusCode = 403;
}

export class UnsupportedMediaTypeError extends Error {
  readonly statusCode = 415;
}

export class UriTooLongError extends Error {
  readonly statusCode = 414;
}

export class RateLimitedError extends Error {
  readonly statusCode = 429;
}
