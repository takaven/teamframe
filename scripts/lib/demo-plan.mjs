/**
 * Pure demo-tenant plan for scripts/seed-demo.mjs — the "Northstar" premium seed.
 *
 * No I/O, no Supabase — just data derived from a `now` timestamp so it can be
 * unit-tested (tests/seed-demo-plan.test.ts) without a database. The seed
 * script consumes this plan and performs the idempotent upserts.
 *
 * The dataset is a 17-person professional-services firm with a real org shape
 * (managing director → leadership layer → individual contributors across
 * Advisory, Finance, Operations and People) so every module demos well:
 *  - departments, positions and reporting lines (including one vacant seat)
 *  - configured leave definitions, plus pending / approved / conflicting leave
 *  - two employees mid-onboarding with open and OVERDUE tasks
 *  - versioned published policies with PARTIAL acknowledgement (+ one draft)
 *  - documents with expiry (one expired, two expiring soon) and open evidence
 *    requests against them
 *  - probation / early-employment records (scheduled, due, completed)
 *  - employment changes (one applied, one pending with a future effective date)
 *  - a signal mix: open red, open yellow, and one resolved (each with an action)
 *
 * Every date is an offset from `now`, so a run is deterministic for a fixed
 * reference date. No Math.random(), no Date.now() inside the plan.
 *
 * 100% synthetic: invented company, invented people, `.example` email domain.
 */

const TENANT_SLUG = "northstar";
const TENANT_NAME = "Northstar Advisory";
const EMAIL_DOMAIN = "northstar.example";

export function isoDaysFrom(now, days) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function dateOnlyDaysFrom(now, days) {
  return isoDaysFrom(now, days).slice(0, 10);
}

/** Inclusive calendar span of a leave request, used for requested_days. */
function calendarDays(startOffset, endOffset) {
  return endOffset - startOffset + 1;
}

/**
 * Build the full declarative demo plan.
 * @param {Date} [now] reference timestamp; defaults to new Date()
 */
export function buildDemoPlan(now = new Date()) {
  return {
    company: {
      slug: TENANT_SLUG,
      name: TENANT_NAME,
      country: "AE",
      location: "Dubai",
      default_timezone: "Asia/Dubai",
      annual_leave_default_days: 25,
      sick_leave_default_days: 15,
      employee_number_prefix: "NS",
    },

    /** Employee key used wherever a row needs an internal "recorded by" actor. */
    adminEmployeeKey: "managingDirector",

    departments: [
      { name: "Leadership", active: true },
      { name: "Advisory", active: true },
      { name: "Finance", active: true },
      { name: "Operations", active: true },
      { name: "People", active: true },
    ],

    // The four system types keep the existing leave engine intact; "Parental
    // Leave" is the custom definition that routes through the 'other' category.
    leaveDefinitions: [
      {
        code: "annual",
        display_name: "Annual Leave",
        system_leave_type: "annual",
        default_entitlement_days: 25,
        counting_basis: "working_days",
        attachment_requirement: "not_required",
        is_system: true,
        sort_order: 10,
      },
      {
        code: "sick",
        display_name: "Sick Leave",
        system_leave_type: "sick",
        default_entitlement_days: 15,
        counting_basis: "working_days",
        attachment_requirement: "optional",
        is_system: true,
        sort_order: 20,
      },
      {
        code: "unpaid",
        display_name: "Unpaid Leave",
        system_leave_type: "unpaid",
        default_entitlement_days: null,
        counting_basis: "working_days",
        attachment_requirement: "not_required",
        is_system: true,
        sort_order: 30,
      },
      {
        code: "parental",
        display_name: "Parental Leave",
        system_leave_type: "other",
        default_entitlement_days: 45,
        counting_basis: "calendar_days",
        attachment_requirement: "required",
        is_system: false,
        sort_order: 40,
      },
    ],

    // keyed employees — the seed resolves keys to row ids after upsert.
    // Managers are declared by key and wired in a second pass.
    employees: [
      {
        key: "managingDirector",
        full_name: "Maya Chen",
        email: `maya.chen@${EMAIL_DOMAIN}`,
        employee_number: "NS-0001",
        role_title: "Managing Director",
        department: "Leadership",
        managerKey: null,
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -2555),
        country: "AE",
      },
      {
        key: "advisoryPartner",
        full_name: "Jordan Vale",
        email: `jordan.vale@${EMAIL_DOMAIN}`,
        employee_number: "NS-0002",
        role_title: "Partner, Advisory",
        department: "Advisory",
        managerKey: "managingDirector",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -1830),
        country: "AE",
      },
      {
        key: "financeDirector",
        full_name: "Avery Stone",
        email: `avery.stone@${EMAIL_DOMAIN}`,
        employee_number: "NS-0003",
        role_title: "Finance Director",
        department: "Finance",
        managerKey: "managingDirector",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -1460),
        country: "AE",
      },
      {
        key: "operationsHead",
        full_name: "Dana Whitfield",
        email: `dana.whitfield@${EMAIL_DOMAIN}`,
        employee_number: "NS-0004",
        role_title: "Head of Operations",
        department: "Operations",
        managerKey: "managingDirector",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -1225),
        country: "AE",
      },
      {
        key: "peopleLead",
        full_name: "Aisha Rahman",
        email: `aisha.rahman@${EMAIL_DOMAIN}`,
        employee_number: "NS-0005",
        role_title: "People Lead",
        department: "People",
        managerKey: "managingDirector",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -980),
        country: "AE",
      },
      {
        key: "seniorConsultant",
        full_name: "Luca Moretti",
        email: `luca.moretti@${EMAIL_DOMAIN}`,
        employee_number: "NS-0006",
        role_title: "Senior Consultant",
        department: "Advisory",
        managerKey: "advisoryPartner",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        // currently away on the approved leave seeded below
        status: "on_leave",
        setup_status: "active",
        lifecycle_state: "on_leave",
        start_date: dateOnlyDaysFrom(now, -730),
        country: "AE",
      },
      {
        key: "corporateConsultant",
        full_name: "Nina Aldridge",
        email: `nina.aldridge@${EMAIL_DOMAIN}`,
        employee_number: "NS-0007",
        role_title: "Consultant, Corporate Advisory",
        department: "Advisory",
        managerKey: "advisoryPartner",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -545),
        country: "AE",
      },
      {
        key: "transactionConsultant",
        full_name: "Ravi Patel",
        email: `ravi.patel@${EMAIL_DOMAIN}`,
        employee_number: "NS-0008",
        role_title: "Consultant, Transaction Advisory",
        department: "Advisory",
        managerKey: "advisoryPartner",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -400),
        country: "AE",
      },
      {
        key: "advisoryAnalyst",
        full_name: "Sofia Ali",
        email: `sofia.ali@${EMAIL_DOMAIN}`,
        employee_number: "NS-0009",
        role_title: "Advisory Analyst",
        department: "Advisory",
        managerKey: "seniorConsultant",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -190),
        country: "AE",
      },
      {
        key: "associateConsultant",
        full_name: "Tomas Lindqvist",
        email: `tomas.lindqvist@${EMAIL_DOMAIN}`,
        employee_number: "NS-0010",
        role_title: "Associate Consultant",
        department: "Advisory",
        managerKey: "seniorConsultant",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -75),
        country: "AE",
      },
      {
        key: "financialAnalyst",
        full_name: "Priya Raman",
        email: `priya.raman@${EMAIL_DOMAIN}`,
        employee_number: "NS-0011",
        role_title: "Financial Analyst",
        department: "Finance",
        managerKey: "financeDirector",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -610),
        country: "AE",
      },
      {
        key: "financeAssistant",
        full_name: "Hugo Salcedo",
        email: `hugo.salcedo@${EMAIL_DOMAIN}`,
        employee_number: "NS-0012",
        role_title: "Finance Assistant",
        department: "Finance",
        managerKey: "financeDirector",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -35),
        country: "AE",
      },
      {
        key: "operationsCoordinator",
        full_name: "Elena Ruiz",
        email: `elena.ruiz@${EMAIL_DOMAIN}`,
        employee_number: "NS-0013",
        role_title: "Operations Coordinator",
        department: "Operations",
        managerKey: "operationsHead",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -880),
        country: "AE",
      },
      {
        key: "systemsAnalyst",
        full_name: "Marco Bianchi",
        email: `marco.bianchi@${EMAIL_DOMAIN}`,
        employee_number: "NS-0014",
        role_title: "Operations Analyst, Systems",
        department: "Operations",
        managerKey: "operationsHead",
        employment_type: "part_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -300),
        country: "AE",
      },
      {
        key: "peopleCoordinator",
        full_name: "Ben Larsen",
        email: `ben.larsen@${EMAIL_DOMAIN}`,
        employee_number: "NS-0015",
        role_title: "People Coordinator",
        department: "People",
        managerKey: "peopleLead",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "active",
        lifecycle_state: "active",
        start_date: dateOnlyDaysFrom(now, -150),
        country: "AE",
      },
      {
        key: "riskConsultant",
        full_name: "Iris Fontaine",
        email: `iris.fontaine@${EMAIL_DOMAIN}`,
        employee_number: "NS-0016",
        role_title: "Consultant, Risk Advisory",
        department: "Advisory",
        managerKey: "advisoryPartner",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "ready",
        lifecycle_state: "preboarding", // starts in 12 days, mid-onboarding
        start_date: dateOnlyDaysFrom(now, 12),
        country: "AE",
      },
      {
        key: "serviceAnalyst",
        full_name: "Samir Haddad",
        email: `samir.haddad@${EMAIL_DOMAIN}`,
        employee_number: "NS-0017",
        role_title: "Operations Analyst, Service Delivery",
        department: "Operations",
        managerKey: "operationsHead",
        employment_type: "full_time",
        timezone: "Asia/Dubai",
        status: "active",
        setup_status: "ready",
        lifecycle_state: "active", // started last week, onboarding still open
        start_date: dateOnlyDaysFrom(now, -6),
        country: "AE",
      },
    ],

    // Org chart. Titles mirror role_title so the chart and the directory agree;
    // parents are declared by key and resolved in plan order (parents first).
    positions: [
      {
        key: "posManagingDirector",
        title: "Managing Director",
        department: "Leadership",
        parentKey: null,
        employeeKey: "managingDirector",
        budgeted: true,
      },
      {
        key: "posAdvisoryPartner",
        title: "Partner, Advisory",
        department: "Advisory",
        parentKey: "posManagingDirector",
        employeeKey: "advisoryPartner",
        budgeted: true,
      },
      {
        key: "posFinanceDirector",
        title: "Finance Director",
        department: "Finance",
        parentKey: "posManagingDirector",
        employeeKey: "financeDirector",
        budgeted: true,
      },
      {
        key: "posOperationsHead",
        title: "Head of Operations",
        department: "Operations",
        parentKey: "posManagingDirector",
        employeeKey: "operationsHead",
        budgeted: true,
      },
      {
        key: "posPeopleLead",
        title: "People Lead",
        department: "People",
        parentKey: "posManagingDirector",
        employeeKey: "peopleLead",
        budgeted: true,
      },
      {
        key: "posSeniorConsultant",
        title: "Senior Consultant",
        department: "Advisory",
        parentKey: "posAdvisoryPartner",
        employeeKey: "seniorConsultant",
        budgeted: true,
      },
      {
        key: "posCorporateConsultant",
        title: "Consultant, Corporate Advisory",
        department: "Advisory",
        parentKey: "posAdvisoryPartner",
        employeeKey: "corporateConsultant",
        budgeted: true,
      },
      {
        key: "posTransactionConsultant",
        title: "Consultant, Transaction Advisory",
        department: "Advisory",
        parentKey: "posAdvisoryPartner",
        employeeKey: "transactionConsultant",
        budgeted: true,
      },
      {
        key: "posRiskConsultant",
        title: "Consultant, Risk Advisory",
        department: "Advisory",
        parentKey: "posAdvisoryPartner",
        employeeKey: "riskConsultant",
        budgeted: true,
      },
      {
        key: "posAdvisoryAnalyst",
        title: "Advisory Analyst",
        department: "Advisory",
        parentKey: "posSeniorConsultant",
        employeeKey: "advisoryAnalyst",
        budgeted: true,
      },
      {
        key: "posAssociateConsultant",
        title: "Associate Consultant",
        department: "Advisory",
        parentKey: "posSeniorConsultant",
        employeeKey: "associateConsultant",
        budgeted: true,
      },
      {
        key: "posFinancialAnalyst",
        title: "Financial Analyst",
        department: "Finance",
        parentKey: "posFinanceDirector",
        employeeKey: "financialAnalyst",
        budgeted: true,
      },
      {
        key: "posFinanceAssistant",
        title: "Finance Assistant",
        department: "Finance",
        parentKey: "posFinanceDirector",
        employeeKey: "financeAssistant",
        budgeted: true,
      },
      {
        key: "posOperationsCoordinator",
        title: "Operations Coordinator",
        department: "Operations",
        parentKey: "posOperationsHead",
        employeeKey: "operationsCoordinator",
        budgeted: true,
      },
      {
        key: "posSystemsAnalyst",
        title: "Operations Analyst, Systems",
        department: "Operations",
        parentKey: "posOperationsHead",
        employeeKey: "systemsAnalyst",
        budgeted: true,
      },
      {
        key: "posServiceAnalyst",
        title: "Operations Analyst, Service Delivery",
        department: "Operations",
        parentKey: "posOperationsHead",
        employeeKey: "serviceAnalyst",
        budgeted: true,
      },
      {
        key: "posPeopleCoordinator",
        title: "People Coordinator",
        department: "People",
        parentKey: "posPeopleLead",
        employeeKey: "peopleCoordinator",
        budgeted: true,
      },
      {
        // Open seat — the org chart demos a vacancy, not just filled boxes.
        key: "posOpenConsultant",
        title: "Consultant, Corporate Advisory (Open)",
        department: "Advisory",
        parentKey: "posAdvisoryPartner",
        employeeKey: null,
        budgeted: true,
      },
    ],

    documents: [
      {
        key: "mdPassport",
        employeeKey: "managingDirector",
        document_type: "passport",
        type: "CV",
        file_name: "passport-ns-0001.pdf",
        signed_at: isoDaysFrom(now, -1100),
        expires_at: isoDaysFrom(now, 720),
      },
      {
        key: "partnerEmiratesId",
        employeeKey: "advisoryPartner",
        document_type: "emirates_id",
        type: "CV",
        file_name: "emirates-id-ns-0002.pdf",
        signed_at: isoDaysFrom(now, -420),
        expires_at: isoDaysFrom(now, 365),
      },
      {
        key: "financeDirectorEmiratesId",
        employeeKey: "financeDirector",
        document_type: "emirates_id",
        type: "CV",
        file_name: "emirates-id-ns-0003.pdf",
        signed_at: isoDaysFrom(now, -530),
        expires_at: isoDaysFrom(now, 200),
      },
      {
        key: "seniorConsultantVisa",
        employeeKey: "seniorConsultant",
        document_type: "visa",
        type: "CV",
        file_name: "visa-ns-0006.pdf",
        signed_at: isoDaysFrom(now, -700),
        expires_at: isoDaysFrom(now, 18), // EXPIRING (within 30 days)
      },
      {
        key: "corporateConsultantEmiratesId",
        employeeKey: "corporateConsultant",
        document_type: "emirates_id",
        type: "CV",
        file_name: "emirates-id-ns-0007.pdf",
        signed_at: isoDaysFrom(now, -740),
        expires_at: isoDaysFrom(now, -9), // EXPIRED → red signal subject
      },
      {
        key: "transactionConsultantContract",
        employeeKey: "transactionConsultant",
        document_type: "employment_contract",
        type: "CONTRACT",
        file_name: "employment-contract-ns-0008.pdf",
        signed_at: isoDaysFrom(now, -395),
        expires_at: null,
      },
      {
        key: "financeAssistantInsurance",
        employeeKey: "financeAssistant",
        document_type: "medical_insurance",
        type: "CV",
        file_name: "medical-insurance-ns-0012.pdf",
        signed_at: isoDaysFrom(now, -34),
        expires_at: isoDaysFrom(now, 26), // EXPIRING (within 30 days)
      },
      {
        key: "operationsCoordinatorVisa",
        employeeKey: "operationsCoordinator",
        document_type: "visa",
        type: "CV",
        file_name: "visa-ns-0013.pdf",
        signed_at: isoDaysFrom(now, -860),
        expires_at: isoDaysFrom(now, 150),
      },
      {
        key: "serviceAnalystPassport",
        employeeKey: "serviceAnalyst",
        document_type: "passport",
        type: "CV",
        file_name: "passport-ns-0017.pdf",
        signed_at: isoDaysFrom(now, -60),
        expires_at: isoDaysFrom(now, 900),
      },
      {
        key: "riskConsultantPassport",
        employeeKey: "riskConsultant",
        document_type: "passport",
        type: "CV",
        file_name: "passport-ns-0016.pdf",
        signed_at: null,
        expires_at: isoDaysFrom(now, 1200),
      },
    ],

    // Outstanding evidence requests. All left in 'requested' so nothing is
    // auto-completed by the accepted-evidence trigger — the demo shows an
    // honest open queue.
    documentRequirements: [
      {
        employeeKey: "riskConsultant",
        document_type: "employment_contract",
        due_date: dateOnlyDaysFrom(now, -2), // OVERDUE request
        expiry_required: false,
        review_required: true,
        employee_upload_allowed: true,
        state: "requested",
        requested_at: isoDaysFrom(now, -16),
      },
      {
        employeeKey: "corporateConsultant",
        document_type: "emirates_id",
        due_date: dateOnlyDaysFrom(now, 7),
        expiry_required: true,
        review_required: true,
        employee_upload_allowed: true,
        state: "requested",
        requested_at: isoDaysFrom(now, -8),
      },
      {
        employeeKey: "seniorConsultant",
        document_type: "visa",
        due_date: dateOnlyDaysFrom(now, 14),
        expiry_required: true,
        review_required: true,
        employee_upload_allowed: false,
        state: "requested",
        requested_at: isoDaysFrom(now, -4),
      },
      {
        employeeKey: "financeAssistant",
        document_type: "medical_fitness",
        due_date: dateOnlyDaysFrom(now, -12), // OVERDUE request
        expiry_required: false,
        review_required: false,
        employee_upload_allowed: true,
        state: "requested",
        requested_at: isoDaysFrom(now, -30),
      },
    ],

    // Two people mid-onboarding (one preboarding, one just started) plus a
    // recent joiner with an outstanding item. Several tasks are OVERDUE.
    onboardingTasks: [
      {
        employeeKey: "riskConsultant",
        title: "Submit passport copy",
        status: "completed",
        owner_role: "employee",
        completion_mode: "document_required",
        required_document_type: "passport",
        due_date: dateOnlyDaysFrom(now, -9),
        completed_at: isoDaysFrom(now, -8),
      },
      {
        employeeKey: "riskConsultant",
        title: "Return signed employment contract",
        status: "pending",
        owner_role: "employee",
        completion_mode: "document_required",
        required_document_type: "employment_contract",
        due_date: dateOnlyDaysFrom(now, -2), // OVERDUE
        completed_at: null,
      },
      {
        employeeKey: "riskConsultant",
        title: "Complete personal and emergency contact details",
        status: "pending",
        owner_role: "employee",
        completion_mode: "manual_confirmation",
        required_document_type: null,
        due_date: dateOnlyDaysFrom(now, 5),
        completed_at: null,
      },
      {
        employeeKey: "riskConsultant",
        title: "Prepare workstation and system access",
        status: "pending",
        owner_role: "admin",
        completion_mode: "manual_confirmation",
        required_document_type: null,
        due_date: dateOnlyDaysFrom(now, 11),
        completed_at: null,
      },
      {
        employeeKey: "serviceAnalyst",
        title: "Read the Northstar Advisory employee handbook",
        status: "completed",
        owner_role: "employee",
        completion_mode: "manual_confirmation",
        required_document_type: null,
        due_date: dateOnlyDaysFrom(now, -4),
        completed_at: isoDaysFrom(now, -5),
      },
      {
        employeeKey: "serviceAnalyst",
        title: "Set up expense and travel booking accounts",
        status: "pending",
        owner_role: "admin",
        completion_mode: "manual_confirmation",
        required_document_type: null,
        due_date: dateOnlyDaysFrom(now, -1), // OVERDUE
        completed_at: null,
      },
      {
        employeeKey: "serviceAnalyst",
        title: "Hold first-week orientation with the Head of Operations",
        status: "pending",
        owner_role: "manager",
        completion_mode: "manual_confirmation",
        required_document_type: null,
        due_date: dateOnlyDaysFrom(now, 1),
        completed_at: null,
      },
      {
        employeeKey: "financeAssistant",
        title: "Submit medical fitness certificate",
        status: "pending",
        owner_role: "employee",
        completion_mode: "document_required",
        required_document_type: "medical_fitness",
        due_date: dateOnlyDaysFrom(now, -12), // OVERDUE
        completed_at: null,
      },
      {
        employeeKey: "financeAssistant",
        title: "Complete finance systems induction",
        status: "completed",
        owner_role: "manager",
        completion_mode: "manual_confirmation",
        required_document_type: null,
        due_date: dateOnlyDaysFrom(now, -25),
        completed_at: isoDaysFrom(now, -24),
      },
    ],

    // Versioned governance set: three published (partially acknowledged below)
    // and one draft, so publish → acknowledge is demonstrable end to end.
    policies: [
      {
        key: "handbook",
        title: "Employee Handbook",
        body:
          "Synthetic demo policy for the Northstar Advisory demo tenant. It describes how the " +
          "handbook is structured, who maintains it, and how employees confirm they have read it. " +
          "It contains no real company rules and creates no obligations.",
        version: 3,
        is_published: true,
        effective_date: dateOnlyDaysFrom(now, -180),
      },
      {
        key: "infoSecurity",
        title: "Information Security Policy",
        body:
          "Synthetic demo policy for the Northstar Advisory demo tenant. It stands in for the " +
          "handling of client data, device security, and access reviews so the acknowledgement " +
          "loop can be demonstrated. It contains no real controls.",
        version: 2,
        is_published: true,
        effective_date: dateOnlyDaysFrom(now, -90),
      },
      {
        key: "expenses",
        title: "Expenses and Travel Policy",
        body:
          "Synthetic demo policy for the Northstar Advisory demo tenant. It stands in for expense " +
          "categories, travel approval, and reimbursement timelines. It contains no real limits.",
        version: 1,
        is_published: true,
        effective_date: dateOnlyDaysFrom(now, -30),
      },
      {
        key: "hybridWorking",
        title: "Remote and Hybrid Working Policy",
        body:
          "Synthetic demo policy for the Northstar Advisory demo tenant, kept unpublished so the " +
          "draft state is visible alongside published versions. It contains no real rules.",
        version: 1,
        is_published: false,
        effective_date: dateOnlyDaysFrom(now, 21),
      },
    ],

    // PARTIAL acknowledgement: the handbook is widely (not fully) acknowledged,
    // information security less so, expenses barely — so "published but not
    // acknowledged" is true for a realistic, shrinking set of people.
    acknowledgements: [
      { policyKey: "handbook", employeeKey: "managingDirector", acknowledged_at: isoDaysFrom(now, -178) },
      { policyKey: "handbook", employeeKey: "advisoryPartner", acknowledged_at: isoDaysFrom(now, -177) },
      { policyKey: "handbook", employeeKey: "financeDirector", acknowledged_at: isoDaysFrom(now, -176) },
      { policyKey: "handbook", employeeKey: "operationsHead", acknowledged_at: isoDaysFrom(now, -175) },
      { policyKey: "handbook", employeeKey: "peopleLead", acknowledged_at: isoDaysFrom(now, -174) },
      { policyKey: "handbook", employeeKey: "seniorConsultant", acknowledged_at: isoDaysFrom(now, -170) },
      { policyKey: "handbook", employeeKey: "corporateConsultant", acknowledged_at: isoDaysFrom(now, -168) },
      { policyKey: "handbook", employeeKey: "transactionConsultant", acknowledged_at: isoDaysFrom(now, -165) },
      { policyKey: "handbook", employeeKey: "financialAnalyst", acknowledged_at: isoDaysFrom(now, -160) },
      { policyKey: "handbook", employeeKey: "operationsCoordinator", acknowledged_at: isoDaysFrom(now, -158) },
      { policyKey: "handbook", employeeKey: "advisoryAnalyst", acknowledged_at: isoDaysFrom(now, -120) },
      { policyKey: "infoSecurity", employeeKey: "managingDirector", acknowledged_at: isoDaysFrom(now, -88) },
      { policyKey: "infoSecurity", employeeKey: "financeDirector", acknowledged_at: isoDaysFrom(now, -86) },
      { policyKey: "infoSecurity", employeeKey: "operationsHead", acknowledged_at: isoDaysFrom(now, -84) },
      { policyKey: "infoSecurity", employeeKey: "peopleLead", acknowledged_at: isoDaysFrom(now, -83) },
      { policyKey: "infoSecurity", employeeKey: "systemsAnalyst", acknowledged_at: isoDaysFrom(now, -70) },
      { policyKey: "expenses", employeeKey: "managingDirector", acknowledged_at: isoDaysFrom(now, -28) },
      { policyKey: "expenses", employeeKey: "financeDirector", acknowledged_at: isoDaysFrom(now, -27) },
      { policyKey: "expenses", employeeKey: "financialAnalyst", acknowledged_at: isoDaysFrom(now, -26) },
    ],

    // Pending (in the approval queue), approved (one in progress right now),
    // and a deliberate overlap for one employee → leave_conflict.
    leaves: [
      {
        employeeKey: "corporateConsultant",
        definitionCode: "annual",
        leave_type: "annual",
        start_date: dateOnlyDaysFrom(now, 9),
        end_date: dateOnlyDaysFrom(now, 13),
        requested_days: calendarDays(9, 13),
        reason: "Family trip booked before the quarter-end close.",
        status: "pending",
      },
      {
        employeeKey: "seniorConsultant",
        definitionCode: "annual",
        leave_type: "annual",
        start_date: dateOnlyDaysFrom(now, -2),
        end_date: dateOnlyDaysFrom(now, 5),
        requested_days: calendarDays(-2, 5),
        reason: "Approved annual leave — currently away.",
        status: "approved",
      },
      {
        employeeKey: "transactionConsultant",
        definitionCode: "annual",
        leave_type: "annual",
        start_date: dateOnlyDaysFrom(now, 20),
        end_date: dateOnlyDaysFrom(now, 24),
        requested_days: calendarDays(20, 24),
        reason: "Approved annual leave.",
        status: "approved",
      },
      {
        // Deliberately overlaps the approved request above → leave_conflict.
        employeeKey: "transactionConsultant",
        definitionCode: "annual",
        leave_type: "annual",
        start_date: dateOnlyDaysFrom(now, 22),
        end_date: dateOnlyDaysFrom(now, 26),
        requested_days: calendarDays(22, 26),
        reason: "Second request raised in error — overlaps an approved booking.",
        status: "pending",
      },
      {
        employeeKey: "financialAnalyst",
        definitionCode: "sick",
        leave_type: "sick",
        start_date: dateOnlyDaysFrom(now, -30),
        end_date: dateOnlyDaysFrom(now, -28),
        requested_days: calendarDays(-30, -28),
        reason: "Short illness, certificate on file.",
        status: "approved",
      },
    ],

    // Probation tracking across all three interesting states.
    probationReviews: [
      {
        employeeKey: "financeAssistant",
        probation_end_date: dateOnlyDaysFrom(now, 55),
        review_due_date: dateOnlyDaysFrom(now, 41),
        status: "scheduled",
        outcome: null,
        outcome_notes: null,
        completed_at: null,
      },
      {
        employeeKey: "associateConsultant",
        probation_end_date: dateOnlyDaysFrom(now, 15),
        review_due_date: dateOnlyDaysFrom(now, 1),
        status: "due",
        outcome: null,
        outcome_notes: null,
        completed_at: null,
      },
      {
        employeeKey: "advisoryAnalyst",
        probation_end_date: dateOnlyDaysFrom(now, -100),
        review_due_date: dateOnlyDaysFrom(now, -114),
        status: "completed",
        outcome: "confirmed",
        outcome_notes: "Synthetic demo record: probation completed and confirmed.",
        completed_at: isoDaysFrom(now, -98),
      },
    ],

    // One change already applied (history) and one scheduled for a future
    // effective date (the pending queue).
    employmentChanges: [
      {
        employeeKey: "seniorConsultant",
        effective_date: dateOnlyDaysFrom(now, 30),
        status: "pending",
        change_keys: ["role_title"],
        old_values: { role_title: "Senior Consultant" },
        new_values: { role_title: "Principal Consultant" },
        idempotency_key: "northstar-demo-promotion-ns-0006",
        recorded_at: isoDaysFrom(now, -3),
        applied_at: null,
        applied_by_actor_type: null,
      },
      {
        employeeKey: "operationsCoordinator",
        effective_date: dateOnlyDaysFrom(now, -60),
        status: "applied",
        change_keys: ["role_title"],
        old_values: { role_title: "Operations Assistant" },
        new_values: { role_title: "Operations Coordinator" },
        idempotency_key: "northstar-demo-promotion-ns-0013",
        recorded_at: isoDaysFrom(now, -75),
        applied_at: isoDaysFrom(now, -60),
        applied_by_actor_type: "system",
      },
    ],

    // Open red + open yellow + one resolved, each with a linked action item.
    signals: [
      {
        kind: "expired_document",
        severity: "red",
        employeeKey: "corporateConsultant",
        documentKey: "corporateConsultantEmiratesId",
        action_title: "Upload renewed Emirates ID",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "The Emirates ID on file expired 9 days ago.",
          why_it_matters: "An expired record blocks client onboarding checks and travel bookings.",
          what_to_do_next: "Upload the renewed Emirates ID against the open evidence request.",
        },
      },
      {
        kind: "leave_conflict",
        severity: "red",
        employeeKey: "transactionConsultant",
        documentKey: null,
        action_title: "Resolve overlapping leave requests",
        action_status: "in_progress",
        resolved_at: null,
        evidence: {
          what_is_wrong: "Two leave requests overlap for the same employee.",
          why_it_matters: "Conflicting leave records confuse approvals and client coverage planning.",
          what_to_do_next: "Cancel or amend the duplicate request so only one booking stands.",
        },
      },
      {
        kind: "expiring_document",
        severity: "yellow",
        employeeKey: "seniorConsultant",
        documentKey: "seniorConsultantVisa",
        action_title: "Start visa renewal",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "The visa on file expires in 18 days.",
          why_it_matters: "Renewals take time and a lapse interrupts client work and travel.",
          what_to_do_next: "Start the renewal and upload the new visa when issued.",
        },
      },
      {
        kind: "expiring_document",
        severity: "yellow",
        employeeKey: "financeAssistant",
        documentKey: "financeAssistantInsurance",
        action_title: "Renew medical insurance certificate",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "The medical insurance certificate expires in 26 days.",
          why_it_matters: "A lapsed certificate leaves a new joiner without confirmed cover.",
          what_to_do_next: "Request the renewed certificate from the insurer and upload it.",
        },
      },
      {
        kind: "missing_contract",
        severity: "yellow",
        employeeKey: "riskConsultant",
        documentKey: null,
        action_title: "Collect signed employment contract",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "The incoming consultant has no signed contract on file.",
          why_it_matters: "Starting work without a signed contract creates legal and audit exposure.",
          what_to_do_next: "Chase the signed contract before the start date in 12 days.",
        },
      },
      {
        kind: "incomplete_onboarding",
        severity: "yellow",
        employeeKey: "serviceAnalyst",
        documentKey: null,
        action_title: "Close out overdue onboarding tasks",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "A new joiner has an overdue onboarding task still open.",
          why_it_matters: "Unfinished setup slows a new joiner down in their first weeks.",
          what_to_do_next: "Complete the expense and travel account setup.",
        },
      },
      {
        kind: "unacknowledged_policy",
        severity: "yellow",
        employeeKey: "peopleCoordinator",
        documentKey: null,
        action_title: "Chase outstanding policy acknowledgements",
        action_status: "open",
        resolved_at: null,
        evidence: {
          what_is_wrong: "Published policies are still unacknowledged by part of the team.",
          why_it_matters: "Unacknowledged policies weaken the record that people were informed.",
          what_to_do_next: "Send a reminder to everyone with an outstanding acknowledgement.",
        },
      },
      {
        kind: "expiring_document",
        severity: "yellow",
        employeeKey: "managingDirector",
        documentKey: "mdPassport",
        action_title: "Confirm renewed passport on file",
        action_status: "done",
        resolved_at: isoDaysFrom(now, -11), // RESOLVED signal
        evidence: {
          what_is_wrong: "The passport on file had been approaching expiry.",
          why_it_matters: "Leadership travel depends on an in-date passport record.",
          what_to_do_next: "Renewed passport was uploaded and the record is now in date.",
        },
      },
    ],
  };
}
