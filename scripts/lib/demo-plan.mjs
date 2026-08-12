/**
 * Pure demo-tenant plan for scripts/seed-demo.mjs (Wave 4).
 *
 * No I/O, no Supabase — just data derived from a `now` timestamp so it can be
 * unit-tested (tests/seed-demo-plan.test.ts) without a database. The seed
 * script consumes this plan and performs the idempotent upserts.
 *
 * Every signal category the demo must make visible is represented here:
 *  - 1 open red signal, 2 open yellow signals, 1 resolved signal (+ actions)
 *  - an employee mid-onboarding with an OVERDUE pending task (due_date column)
 *  - an expiring document (expires within 30 days)
 *  - a published-but-unacknowledged policy (Wave 1 policies loop)
 *  - a pending leave request
 *
 * All names/emails are clearly fake (.example domain). No real PII.
 */

export function isoDaysFrom(now, days) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function dateOnlyDaysFrom(now, days) {
  return isoDaysFrom(now, days).slice(0, 10);
}

/**
 * Build the full declarative demo plan.
 * @param {Date} [now] reference timestamp; defaults to new Date()
 */
export function buildDemoPlan(now = new Date()) {
  return {
    company: { slug: "demo-fpors", name: "Demo FPORS Startup" },

    // keyed employees — the seed resolves keys to row ids after upsert
    employees: [
      {
        key: "founder",
        full_name: "Sara Founder",
        email: "sara.founder@demo-fpors.example",
        role_title: "Founder",
        department: "Leadership",
        timezone: "Asia/Dubai",
        status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -120),
        country: "UAE",
      },
      {
        key: "operator",
        full_name: "Lina Operations",
        email: "lina.ops@demo-fpors.example",
        role_title: "Operations Manager",
        department: "Operations",
        timezone: "Asia/Dubai",
        status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -40),
        country: "UAE",
      },
      {
        key: "newHire",
        full_name: "Omar New Hire",
        email: "omar.newhire@demo-fpors.example",
        role_title: "Software Engineer",
        department: "Engineering",
        timezone: "Asia/Dubai",
        status: "active",
        lifecycle_state: "preboarding", // mid-onboarding
        start_date: dateOnlyDaysFrom(now, 14),
        country: "UAE",
      },
    ],

    documents: [
      {
        key: "founderPassport",
        employeeKey: "founder",
        document_type: "passport",
        type: "CV",
        file_name: "demo-passport.pdf",
        signed_at: isoDaysFrom(now, -150),
        expires_at: isoDaysFrom(now, 240),
      },
      {
        key: "operatorEmiratesId",
        employeeKey: "operator",
        document_type: "emirates_id",
        type: "PHOTO",
        file_name: "demo-emirates-id.pdf",
        signed_at: isoDaysFrom(now, -300),
        expires_at: isoDaysFrom(now, -5), // expired → red signal subject
      },
      {
        key: "newHirePassport",
        employeeKey: "newHire",
        document_type: "passport",
        type: "CV",
        file_name: "demo-passport-newhire.pdf",
        signed_at: null,
        expires_at: isoDaysFrom(now, 25), // EXPIRING document (within 30 days)
      },
    ],

    // Mid-onboarding: one task done, one OVERDUE pending (due_date in the past),
    // one pending with a future due date.
    onboardingTasks: [
      {
        employeeKey: "newHire",
        title: "Read the demo employee handbook",
        status: "completed",
        due_date: dateOnlyDaysFrom(now, -7),
        completed_at: isoDaysFrom(now, -2),
      },
      {
        employeeKey: "newHire",
        title: "Sign demo employment contract",
        status: "pending",
        due_date: dateOnlyDaysFrom(now, -3), // OVERDUE
        completed_at: null,
      },
      {
        employeeKey: "newHire",
        title: "Set up demo laptop and accounts",
        status: "pending",
        due_date: dateOnlyDaysFrom(now, 5),
        completed_at: null,
      },
    ],

    // Published policy with deliberately NO acknowledgements seeded →
    // "published-but-unacknowledged" is demonstrable for every employee.
    policies: [
      {
        title: "Demo Code of Conduct",
        body:
          "This is a clearly-fake demo policy for the demo-fpors tenant. " +
          "It exists so the unacknowledged-policy signal and the /policies " +
          "acknowledgement loop are demonstrable. It contains no real rules.",
        version: 1,
        is_published: true,
      },
    ],

    leaves: [
      {
        employeeKey: "operator",
        start_date: dateOnlyDaysFrom(now, 10),
        end_date: dateOnlyDaysFrom(now, 12),
        leave_type: "annual",
        requested_days: 3,
        reason: "Synthetic annual leave request for the founder review demo.",
        status: "pending", // pending leave in the admin queue
      },
    ],

    // 1 red open, 2 yellow open, 1 resolved (severity lives on the signal;
    // resolved_at set → resolved). Each signal gets a linked action item.
    signals: [
      {
        kind: "expired_document",
        severity: "red",
        employeeKey: "operator",
        documentKey: "operatorEmiratesId",
        action_title: "Upload renewed Emirates ID",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "Emirates ID is expired.",
          why_it_matters: "This can block operations and create compliance risk for the company.",
          what_to_do_next: "Upload renewed Emirates ID.",
        },
      },
      {
        kind: "expiring_document",
        severity: "yellow",
        employeeKey: "newHire",
        documentKey: "newHirePassport",
        action_title: "Request renewal for passport",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "Passport is expiring soon.",
          why_it_matters: "Travel and onboarding can be blocked if renewal is delayed.",
          what_to_do_next: "Request passport renewal now.",
        },
      },
      {
        kind: "missing_contract",
        severity: "yellow",
        employeeKey: "newHire",
        documentKey: null,
        action_title: "Upload signed contract",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "New hire has no signed contract on file.",
          why_it_matters: "Starting work without a signed contract creates legal and compliance risk.",
          what_to_do_next: "Upload a signed contract before start date.",
        },
      },
      {
        kind: "expiring_document",
        severity: "yellow",
        employeeKey: "founder",
        documentKey: "founderPassport",
        action_title: "Request renewal for passport",
        action_status: "done",
        resolved_at: isoDaysFrom(now, 0), // RESOLVED signal
        evidence: {
          what_is_wrong: "Passport had been expiring soon.",
          why_it_matters: "Founders need uninterrupted travel and compliance readiness.",
          what_to_do_next: "Renewed passport uploaded.",
        },
      },
    ],
  };
}
