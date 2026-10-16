import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => {
  const scope = {
    setTag: vi.fn(),
    setExtras: vi.fn(),
  };

  return {
    init: vi.fn(),
    captureException: vi.fn(),
    captureRequestError: vi.fn(),
    captureRouterTransitionStart: vi.fn(),
    withScope: vi.fn((callback: (value: typeof scope) => void) => callback(scope)),
    scope,
  };
});

vi.mock("@sentry/nextjs", () => sentry);

type TestEvent = {
  user?: Record<string, unknown>;
  request?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  exception?: { values: Array<{ value: string }> };
  breadcrumbs?: Array<{ message: string; data?: Record<string, unknown> }>;
};

type InitOptions = {
  sendDefaultPii?: boolean;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  beforeSend?: (event: TestEvent) => TestEvent | null;
};

function latestInitOptions(): InitOptions {
  const call = sentry.init.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call?.[0] as InitOptions;
}

function makeSensitiveEvent(): TestEvent {
  return {
    user: { email: "employee@example.invalid", name: "Employee Name" },
    request: {
      method: "POST",
      url: "https://app.example.invalid/action?email=employee@example.invalid&token=secret",
      headers: { authorization: "Bearer secret-token" },
      data: { employee: "Employee Name" },
    },
    extra: {
      email: "employee@example.invalid",
      nested: { password: "secret", note: "contact employee@example.invalid" },
    },
    exception: {
      values: [{ value: "provider rejected employee@example.invalid" }],
    },
    breadcrumbs: [
      {
        message: "sign-in for employee@example.invalid",
        data: { authorization: "Bearer secret-token" },
      },
    ],
  };
}

function assertPrivacyContract(options: InitOptions): void {
  expect(options.sendDefaultPii).toBe(false);
  expect(options.tracesSampleRate).toBe(0);
  expect(options.beforeSend).toBeTypeOf("function");

  const result = options.beforeSend?.(makeSensitiveEvent());
  expect(result).not.toBeNull();
  expect(result?.user).toBeUndefined();
  expect(result?.request).toEqual({
    method: "POST",
    url: "https://app.example.invalid/action",
  });
  expect(result?.extra).toEqual({
    email: "[REDACTED]",
    nested: { password: "[REDACTED]", note: "contact [REDACTED_EMAIL]" },
  });
  expect(result?.exception?.values[0]?.value).toBe(
    "provider rejected [REDACTED_EMAIL]",
  );
  expect(result?.breadcrumbs?.[0]).toEqual({
    message: "sign-in for [REDACTED_EMAIL]",
    data: { authorization: "[REDACTED]" },
  });
}

describe("Sentry 10 instrumentation compatibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("initialises the server runtime with privacy-safe event handling", async () => {
    await import("../sentry.server.config");

    expect(sentry.init).toHaveBeenCalledTimes(1);
    assertPrivacyContract(latestInitOptions());
  });

  it("initialises the edge runtime with the same privacy contract", async () => {
    await import("../sentry.edge.config");

    expect(sentry.init).toHaveBeenCalledTimes(1);
    assertPrivacyContract(latestInitOptions());
  });

  it("initialises the client without traces, replay, or default PII", async () => {
    const client = await import("../instrumentation-client");

    expect(client.onRouterTransitionStart).toBe(sentry.captureRouterTransitionStart);
    expect(sentry.init).toHaveBeenCalledTimes(1);

    const options = latestInitOptions();
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    assertPrivacyContract(options);
  });

  it("keeps action capture functional and scrubs structured context", async () => {
    const { captureActionError } = await import("@/lib/telemetry/sentry");
    const error = new Error("synthetic compatibility event");

    captureActionError("updateEmployee", error, {
      actor_user_id: "synthetic-user-id",
      actor_tenant_id: "synthetic-tenant-id",
      email: "employee@example.invalid",
      detail: "contact employee@example.invalid",
    });

    expect(sentry.scope.setTag).toHaveBeenCalledWith("action", "updateEmployee");
    expect(sentry.scope.setTag).toHaveBeenCalledWith("user_id", "synthetic-user-id");
    expect(sentry.scope.setTag).toHaveBeenCalledWith("tenant_id", "synthetic-tenant-id");
    expect(sentry.scope.setExtras).toHaveBeenCalledWith({
      email: "[REDACTED]",
      detail: "contact [REDACTED_EMAIL]",
    });
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("remains dormant when no DSN is configured", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    await import("../sentry.server.config");
    await import("../sentry.edge.config");
    await import("../instrumentation-client");

    expect(sentry.init).not.toHaveBeenCalled();
  });
});
