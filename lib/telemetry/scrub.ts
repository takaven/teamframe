/**
 * TeamFrame — PII scrubber
 *
 * Strips known personally-identifiable keys from arbitrary payloads before
 * they reach log output or Sentry. Used by both logger.ts (server) and
 * sentry.{client,server,edge}.config.ts (both sides).
 *
 * Rules:
 *  - keys are matched case-insensitively
 *  - nested objects are recursed up to MAX_DEPTH levels
 *  - arrays are recursed: object elements are scrubbed, scalars pass through
 *  - never throws
 */

const PII_KEYS = new Set([
  "email",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "phone_number",
  "mobile",
  "address",
  "street",
  "city",
  "postcode",
  "zip",
  "token",
  "magic_link",
  "otp",
  "password",
  "secret",
  "ip",
  "ip_address",
  "user_agent",
  "body",
  "raw_body",
  "request_body",
  "authorization",
  "cookie",
  "set-cookie",
  "set_cookie",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "session_token",
]);

const MAX_DEPTH = 5;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_RE = /\bBearer\s+[^\s,;]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function scrubSensitiveText(value: string): string {
  return value
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(JWT_RE, "[REDACTED_TOKEN]");
}

export function scrubPII(
  payload: Record<string, unknown>,
  _depth = 0,
): Record<string, unknown> {
  if (_depth > MAX_DEPTH) return payload;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? scrubPII(item as Record<string, unknown>, _depth + 1)
          : typeof item === "string"
            ? scrubSensitiveText(item)
            : item,
      );
    } else if (
      value !== null &&
      typeof value === "object"
    ) {
      result[key] = scrubPII(value as Record<string, unknown>, _depth + 1);
    } else {
      result[key] = typeof value === "string" ? scrubSensitiveText(value) : value;
    }
  }

  return result;
}

/**
 * Apply the general PII scrubber to a Sentry event and retain only the safe,
 * operationally useful portion of request context. Request bodies, headers,
 * cookies and query strings are intentionally excluded.
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const scrubbed = scrubPII(event) as T;
  const scrubbedRecord = scrubbed as Record<string, unknown>;
  delete scrubbedRecord.user;

  const request = event.request;
  if (request && typeof request === "object" && !Array.isArray(request)) {
    const rawRequest = request as Record<string, unknown>;
    const safeRequest: Record<string, unknown> = {};

    if (typeof rawRequest.method === "string") {
      safeRequest.method = rawRequest.method;
    }
    if (typeof rawRequest.url === "string") {
      safeRequest.url = scrubSensitiveText(rawRequest.url.split(/[?#]/, 1)[0] ?? "");
    }

    scrubbedRecord.request = safeRequest;
  }

  return scrubbedRecord as T;
}
