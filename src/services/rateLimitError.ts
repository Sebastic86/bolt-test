/**
 * Thrown by logo sources when the API answers 429 Too Many Requests, so
 * callers can back off instead of treating it as "no logo for this team".
 */
export class RateLimitError extends Error {
  constructor(
    readonly source: string,
    /** Seconds the server asked us to wait (Retry-After), when it said. */
    readonly retryAfterSeconds: number | null = null
  ) {
    super(`${source} rate limit reached (429)`);
    this.name = 'RateLimitError';
  }
}

export function rateLimitErrorFrom(source: string, response: Response): RateLimitError {
  const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
  return new RateLimitError(source, Number.isNaN(retryAfter) ? null : retryAfter);
}
