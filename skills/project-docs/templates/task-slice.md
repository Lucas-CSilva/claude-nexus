# Task NN: [Slice Name]

> **Spec:** SPEC-NNN — [Feature Name]
> **Slice:** N of M
> **Status:** Not Started | In Progress | Done
> **Depends on:** [prior task file(s), or "none — first slice"]
> **Blocks:** [later task file(s) that need this one done first, or "nothing — safe to pause here"]

---

## Goal

> *One to two sentences: what this slice delivers, in concrete terms — not "improve reliability" but "publish a BalanceProjectionMessage per inserted transaction."*

---

## Why this is a checkpoint

> *One to two sentences: what makes this slice independently mergeable and testable without the rest of the feature existing yet. If you can't say why it stands alone, it may not be a real slice — reconsider the split.*

**Example:**
> Nothing consumes these messages yet, so this slice is verified by asserting a message lands on the queue when a transaction is inserted — not that any balance changes (it won't yet, that's the next slice).

---

## Checklist

- [ ] [Concrete, verifiable item]
- [ ] [Concrete, verifiable item]
- [ ] Test: [what proves this specific slice, not the whole feature]

---

## Definition of Done

> *The observable condition that proves this slice works, before moving to the next one. Should be checkable without needing later slices to exist.*

---

## Notes / Deferred

> *Anything explicitly punted past this slice — so a reader doesn't mistake "not built yet" for "forgotten." Delete this section if nothing applies.*
