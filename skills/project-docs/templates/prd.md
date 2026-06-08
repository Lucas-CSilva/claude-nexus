# PRD: [Feature / Project Name]

> **Document metadata**
> - **ID:** PRD-NNN
> - **Status:** Draft | In Review | Approved
> - **Author:** [Name / Role]
> - **Last updated:** YYYY-MM-DD
> - **Reviewers:** [Names]

---

## 1. Problem Statement

> *One to three paragraphs. Describe the real-world problem being solved — not the solution. Answer: what is broken or missing, who is affected, and why does it matter now? Use concrete, observable terms.*

**Example:**
> Users who register on mobile cannot recover their account if they lose access to their email, because the current flow relies entirely on an email magic link. Support tickets for this account-recovery failure account for 34% of all support volume. Competitors offer at least one alternative (SMS or authenticator app). This gap is causing measurable churn among mobile-first users.

---

## 2. Goals

> *Bullet list. Each goal is a concrete, measurable outcome the project must achieve. Prefer verbs: "reduce", "enable", "eliminate".*

- [ ] Goal 1 (e.g., reduce account-recovery support tickets by 50% within 90 days of launch)
- [ ] Goal 2
- [ ] Goal 3

### Non-Goals

> *Explicit list of what this project will NOT do. Non-goals prevent scope creep and set expectations for stakeholders.*

- Not in scope: [e.g., redesigning the full onboarding flow]
- Not in scope: [e.g., supporting hardware security keys (FIDO2) — deferred to a future ADR]

---

## 3. Users and Context

> *Briefly describe the affected user segments. If personas already exist, reference them. Identify any secondary actors (admins, third-party systems).*

| Segment | Description | Volume / Impact |
|---|---|---|
| Mobile-first user | Registered via mobile, no desktop session | High — ~60% of new signups |
| Admin | Manages user accounts via dashboard | Low — internal only |

---

## 4. Use Cases

> *Each use case has a unique ID (`UC-NNN`), a primary actor, a goal, and a numbered happy-path sequence. Add alternate/error paths for anything non-trivial. Keep prose tight; use a flowchart (mermaid skill) only when the branching is too complex for prose.*

### UC-001: Account recovery via SMS

**Actor:** Mobile-first user  
**Goal:** Regain access to account after losing email access  
**Precondition:** User has a verified phone number on file

1. User navigates to login page and selects "Forgot password".
2. System presents recovery options: email or SMS.
3. User selects SMS.
4. System sends a one-time code to the verified phone number.
5. User enters the code within 10 minutes.
6. System authenticates the user and redirects to the password-reset screen.

**Alternate path 2a — no phone number on file:** System shows only the email option and displays a help link.  
**Error path 5a — code expired:** System offers to resend; limits resend to 3 attempts per hour.

---

## 5. Functional Requirements

> *One requirement per row. ID is permanent and never reused. Priority: P0 = must-have for launch, P1 = should-have, P2 = nice-to-have. Description is a single declarative sentence stating what the system must do.*

| ID | Priority | Description |
|---|---|---|
| FR-001 | P0 | The system shall allow a registered user to initiate account recovery via SMS if a verified phone number exists on their profile. |
| FR-002 | P0 | The system shall generate a cryptographically random 6-digit OTP and deliver it via the configured SMS provider. |
| FR-003 | P0 | The system shall reject an OTP that is older than 10 minutes or has already been used. |
| FR-004 | P0 | The system shall limit OTP resend attempts to 3 per user per hour. |
| FR-005 | P1 | The system shall log each recovery attempt (success/failure, method used) to the audit trail. |
| FR-006 | P2 | The system shall allow a user to add or update their phone number from the account-settings page. |

> *Add rows as needed. Keep descriptions atomic — one observable behaviour per ID. If a requirement is removed, mark it `[REMOVED]` and leave the row.*

---

## 6. Non-Functional Requirements

> *System-level qualities: performance, security, reliability, compliance, accessibility. Same ID discipline as functional requirements.*

| ID | Category | Description |
|---|---|---|
| NFR-001 | Performance | OTP delivery shall complete within 5 seconds under normal load (p95). |
| NFR-002 | Security | OTPs shall be hashed (bcrypt or Argon2) before storage; plaintext shall never be persisted. |
| NFR-003 | Reliability | SMS delivery shall be routed through a provider with SLA ≥ 99.5% uptime. |
| NFR-004 | Compliance | Phone number collection and use shall comply with applicable data-protection regulations (e.g., GDPR, LGPD). |
| NFR-005 | Accessibility | All UI elements in the recovery flow shall meet WCAG 2.1 AA. |

---

## 7. Acceptance Criteria

> *Verifiable conditions that define "done". Each criterion maps to one or more requirement IDs. Written in Given/When/Then or as a testable assertion.*

| ID | Linked Requirements | Criterion |
|---|---|---|
| AC-001 | FR-001, FR-002 | Given a user with a verified phone number, when they choose SMS recovery, then they receive an OTP SMS within 5 seconds. |
| AC-002 | FR-003 | Given a valid OTP, when it is submitted more than 10 minutes after generation, then the system returns an error and does not authenticate the user. |
| AC-003 | FR-004 | Given a user who has requested 3 OTPs in the last hour, when they request another, then the system rejects the request with a rate-limit error. |
| AC-004 | NFR-002 | Given any OTP generated, then no plaintext OTP value exists in any database table, log, or external service payload. |

---

## 8. Out of Scope

> *Be explicit. Anything not listed in Functional Requirements is out of scope by default, but call out the most likely misunderstandings explicitly.*

- FIDO2 / WebAuthn hardware key support
- Authenticator-app (TOTP) recovery
- Admin-initiated account unlock
- Changes to the existing email magic-link flow

---

## Appendix: Open Questions

> *Track unresolved questions here. Each gets a decision when resolved — move the answer into the relevant section and close the question.*

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Which SMS provider do we use? Twilio vs AWS SNS? | Architect | Open |
| 2 | Is phone number already captured at signup? | BA | Resolved — no, must be added |
