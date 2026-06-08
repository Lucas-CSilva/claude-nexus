# ADR-NNN: [Short Decision Title]

> **Document metadata**
> - **ID:** ADR-NNN  
> - **Status:** Proposed | Accepted | Superseded by ADR-NNN | Deprecated
> - **Author:** [Name / Role]
> - **Date:** YYYY-MM-DD
> - **Linked PRD:** PRD-NNN *(if this decision was triggered by specific requirements)*
> - **Linked Spec:** SPEC-NNN *(if this decision is referenced from a tech spec)*

---

## Context

> *Describe the situation that forced this decision. What is the problem being solved? What forces or constraints are in tension? Mention any relevant requirement IDs from the PRD.*
>
> *Write in past/present tense as if explaining the situation to someone who wasn't in the room. Be specific — name the actual constraints (performance numbers, team size, existing stack, regulatory requirements).*

**Example:**
> The SMS-based OTP flow (FR-001 through FR-004) requires storing short-lived, single-use codes with sub-second read/write latency. We currently have a Postgres primary DB and no caching layer. Two options emerged: store OTPs in a dedicated Postgres table with a scheduled cleanup job, or introduce Redis as a TTL-native key-value store. The team has no prior Redis operational experience.

---

## Decision

> *State the decision in one or two clear sentences. Start with "We will…" or "We have decided to…".*

We will introduce a Redis instance as the OTP store, using key TTL to handle expiry natively, rather than writing OTPs to Postgres.

---

## Status

`Accepted` — YYYY-MM-DD

> *Valid statuses:*
> - `Proposed` — under discussion
> - `Accepted` — in effect
> - `Superseded by ADR-NNN` — replaced; link to the new ADR
> - `Deprecated` — no longer relevant but not replaced

---

## Consequences

> *What becomes true after this decision? Cover both positive and negative consequences. Be honest — listing only upsides signals that the decision was not fully thought through.*

**Positive:**
- OTP expiry is handled by Redis TTL with no cleanup job needed.
- Read/write latency is O(1) and well under the NFR-001 p95 target.
- OTP data is segregated from the primary DB, limiting blast radius of a DB outage.

**Negative:**
- Adds operational complexity: Redis must be provisioned, monitored, and backed up.
- The team must learn Redis operational patterns (eviction policies, persistence config).
- If Redis is unavailable, the entire SMS recovery flow is unavailable.

**Risks and mitigations:**
- *Risk:* Redis data loss on crash. *Mitigation:* Enable AOF persistence; OTP loss is recoverable (user retries).
- *Risk:* Cache stampede on high OTP volume. *Mitigation:* OTPs are per-user; no shared hot key.

---

## Alternatives Considered

> *List every alternative that was seriously considered. For each: what it is, why it was rejected. This section is often the most valuable part of an ADR — it prevents the team from re-litigating the same options later.*

### Option A: OTPs in Postgres (rejected)

Store OTPs in a dedicated table (`otp_codes`) with a `expires_at` column and a scheduled cleanup job (e.g., pg_cron every minute).

**Rejected because:**
- Requires a schema migration and a recurring job to manage.
- Adds write pressure to the primary DB on every OTP generation and validation.
- Cleanup job introduces a small window where expired OTPs are present in the table.

### Option B: Redis with Redis Cluster (deferred)

Use Redis Cluster for high availability from day one.

**Deferred because:**
- Single-instance Redis is sufficient at current scale (< 1k active recovery sessions/day).
- Cluster adds operational overhead not justified at this stage. Revisit if traffic grows 10×.

### Option C: External OTP-as-a-service (e.g., Vonage Verify) (rejected)

Delegate OTP generation, delivery, and validation to a third-party service.

**Rejected because:**
- Adds a vendor dependency on the validation critical path; a provider outage blocks recovery entirely.
- FR-003 requires us to control OTP expiry logic; delegating this reduces auditability.
- Cost per validation at scale is significantly higher than self-hosting.

---

## References

> *Links, prior art, relevant documentation. Optional.*

- [Twilio OTP best practices](https://www.twilio.com/docs/verify/best-practices)
- NFR-001, NFR-002, NFR-003 — non-functional requirements from PRD-001
- SPEC-001 §4.1 — Redis key schema
