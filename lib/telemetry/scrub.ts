/**
 * TeamFrame — PII scrubber
 *
 * Strips known personally-identifiable keys from arbitrary payloads before
 * they reach log output or Sentry. Used by both logger.ts (server) and
 * sentry.{client,server,edge}.config.ts (both sides).
 *
 * Rules:
 *  - keys are matched case-insensitively
 *  - nested objects and arrays are recursed up to MAX_DEPTH levels
 *  - depth, collection size, string length and total work are bounded
 *  - circular references and truncated values are replaced with safe markers
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
const MAX_COLLECTION_ITEMS = 100;
const MAX_TOTAL_VALUES = 1_000;
const MAX_STRING_LENGTH = 4_096;

const CIRCULAR_MARKER = "[CIRCULAR]";
const TRUNCATED_MARKER = "[TRUNCATED]";
const UNAVAILABLE_MARKER = "[UNAVAILABLE]";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_RE = /\bBearer\s+[^\s,;]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function scrubSensitiveText(value: string): string {
  if (value.length > MAX_STRING_LENGTH) return TRUNCATED_MARKER;

  return value
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(JWT_RE, "[REDACTED_TOKEN]");
}

type ScrubState = {
  ancestors: WeakSet<object>;
  remainingValues: number;
};

function scrubValue(
  value: unknown,
  depth: number,
  state: ScrubState,
): unknown {
  if (state.remainingValues <= 0) return TRUNCATED_MARKER;
  state.remainingValues -= 1;

  if (typeof value === "string") return scrubSensitiveText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH) return TRUNCATED_MARKER;
  if (state.ancestors.has(value)) return CIRCULAR_MARKER;

  state.ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const result = value
        .slice(0, MAX_COLLECTION_ITEMS)
        .map((item) => scrubValue(item, depth + 1, state));

      if (value.length > MAX_COLLECTION_ITEMS) result.push(TRUNCATED_MARKER);
      return result;
    }

    const result: Record<string, unknown> = {};
    let included = 0;

    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (included >= MAX_COLLECTION_ITEMS) break;

      const nestedValue = (value as Record<string, unknown>)[key];
      result[key] = PII_KEYS.has(key.toLowerCase())
        ? "[REDACTED]"
        : scrubValue(nestedValue, depth + 1, state);
      included += 1;
    }

    return result;
  } catch {
    return UNAVAILABLE_MARKER;
  } finally {
    state.ancestors.delete(value);
  }
}

export function scrubPII(
  payload: Record<string, unknown>,
  _depth = 0,
): Record<string, unknown> {
  const result = scrubValue(payload, _depth, {
    ancestors: new WeakSet<object>(),
    remainingValues: MAX_TOTAL_VALUES,
  });

  return result !== null && typeof result === "object" && !Array.isArray(result)
    ? result as Record<string, unknown>
    : {};
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
