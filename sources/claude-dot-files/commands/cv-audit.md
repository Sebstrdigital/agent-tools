---
name: cv-audit
description: "Audit a CV / resume / professional bio for redundancy, role-soup, filler, and weak signal. Reads the file, identifies specific anti-patterns with line references, then runs a targeted interview based on what it found to produce a trim plan. Triggers on: cv audit, audit cv, resume review, bio audit, cv redundancy, saying too much."
source_id: dua-cv-tools
version: 1.0.0
---

# CV Audit

Audit a CV / resume / bio for the specific failure mode: **saying too much to say too little**. Detects redundancy, role-soup, filler, and claims without evidence. Produces a trim plan grounded in a targeted interview — not a generic rewrite.

The audit is anchored to what's actually in the document. Generic "tell me about your strengths" interviews waste turns. This skill reads first, finds the actual drift patterns, then asks you only about the tradeoffs it can't decide alone.

---

## Canonical patterns (the "good" reference)

Three established frameworks ground this skill's recommendations. They don't contradict — they stack: the genre frames the document, CAR shapes the sentence, Bock quantifies it.

### 1. Bock's formula *(Laszlo Bock — "Work Rules", 2015)*

> **"Accomplished [X] as measured by [Y] by doing [Z]."**

The primary sentence-level test. Every bullet describing a past outcome should, ideally, satisfy this. If you can't fill in [Y] (the measurement), the claim is an assertion without evidence. If you can't fill in [Z] (the action), the claim is a vanity metric. Both parts have to be there.

Swiss alignment: demands quantified proof, eliminates filler by structure. Specificity *is* restraint.

### 2. CAR — Challenge · Action · Result

Compact three-beat structure for outcome sentences. One line each:

- **Challenge** — what was the constraint or problem?
- **Action** — what did *you* do (scope-appropriate, no "we")?
- **Result** — what changed, in concrete terms?

Swiss alignment: three beats, no filler, ~one line each. CAR is STAR minus the bloat (Situation + Task collapse into Challenge).

### 3. Consultant capabilities-statement (genre frame)

The document genre question: *what kind of CV is this?* A consultant CV is **not** a chronological employee CV. It's a capabilities statement:

- Leads with outcomes and capabilities, not with "where I worked"
- Chronological employment is a supporting section, not the spine
- Assignments are the primary evidence
- Role-labeling is minimized — the work demonstrates the role

Swiss alignment: this is the "removal over addition" move at the document level. Half the CV-canon (academic/Harvard style, ATS-optimized employee CV, narrative staff-engineer bio) assumes a different genre. For a consultant one-page CV, that canon bloats.

**How these three combine:** the document is a capabilities statement (genre), each piece of evidence is a CAR sentence (structure), and wherever possible CAR upgrades to Bock (quantification). Every anti-pattern below fails one of these three.

---

## When to use

- User says "my CV says too much", "I'm being verbose", "trim my resume", "cv audit"
- After a design pass on a portfolio / CV page, before shipping copy
- Before exporting a PDF version of a bio
- When a CV lists 4+ role titles or restates the same fact across sections

Not for: writing a CV from scratch (use `/brand-voice` + `/ux-copy` or draft manually), grammar/spell-check, or layout/design review.

---

## The Job

1. **Read** the target CV file (user points at it, or default to first `.md` file in `src/content/team/` or `CV/`).
2. **Scan** for 6 anti-patterns (below). Produce an **evidence report** with file:line citations.
3. **Run targeted interview** — only questions the audit can't answer alone (priority audience, which instance of a duplicate claim wins, what to cut vs. keep).
4. **Synthesize** a trim plan: what to remove, what to merge, what to rewrite, what to keep.
5. **Present for approval.** Do not edit the file yet.
6. On approval: apply edits in a single pass. Report diff summary.

**Rule: this is an audit, not a rewrite.** Output is a plan + approval gate + surgical edits. Not a new CV from scratch.

---

## The 6 anti-patterns

Scan the document for each. Each finding gets a file:line citation + one-line explanation.

Each anti-pattern below is tagged with which canonical pattern its fix maps to.

### 1. Stacked titles  *(genre)*
Two or more role names joined with `—`, `/`, `&`, `·`, or commas in the same label.

> Bad: `Senior Software Consultant — Developer & Solution Architect`
> Bad: `Lead developer, architect and project lead for Nordic clients`
> Good: `Senior Consultant` (pick one)

**Why it fails:** Reader can't tell what you actually are. Stacking reads as insecurity — "I'm all of these, please pick one you like."

### 2. Repeated claims (duplicate facts)  *(genre)*
Same fact stated in 2+ sections. Common repeaters: CTO/founder status, years of experience, geography (Bali/remote/Nordic), role types (developer/architect/lead), client focus.

Build a claim table. Example output format:

| Claim | Stated at |
|---|---|
| CTO of Dua Digital | line 4 (tagline), line 19 (profile), line 99 (employments) |
| Remote worldwide | line 5, line 19 |
| Nordic clients | line 4, line 19 |
| 10+ years | line 13, line 19 |

**Why it fails:** Each restatement weakens the signal. A fact stated once with confidence is stronger than the same fact restated three times.

### 3. Role-soup lists  *(genre)*
Any `·`-separated or bulleted list of role titles > 3 items, or a "Roles" section that enumerates every role ever held.

> Bad: `Senior Developer · Solution Architect · Project Lead · Scrum Master · Key Account · CTO`
> Good: Drop the list — demonstrate via assignments, not labels.

**Why it fails:** The assignments already prove the roles. Listing them again is tell-don't-show — the exact opposite of what a CV should do.

### 4. Filler verbs & phrases  *(CAR / Bock)*
Phrases that add length without signal: "responsible for", "delivers as", "hands-on", "passionate about", "drives", "owns", "full-stack", "cross-functional", "end-to-end", "results-driven", "proven track record".

Flag each occurrence. These don't inherently fail — but they almost always can be replaced with a specific outcome or removed.

### 5. Claims without evidence  *(Bock)*
Adjectives or superlatives with no concrete proof nearby: "senior", "expert", "experienced", "comprehensive", "extensive", "strong", "deep".

> Bad: `Deep expertise in cloud architecture`
> Good: `Led AWS migration for a 50k-user PropTech platform`

**Why it fails:** Assertion without evidence reads as self-branding. Specific work proves the claim.

### 6. Geography / work-style restating  *(genre)*
Location, remote-status, availability stated in 2+ places. Pick one canonical spot (usually the header metadata row).

---

## Interview

After the audit scan, run a **short targeted interview** — only questions the audit can't answer by itself. Keep it to 2-4 questions total.

### Question types (ask only the ones relevant to findings)

**Audience anchor (always ask if unclear):**
> Who is this CV for — clients considering a contract, recruiters for a full-time role, peers/network, or mixed? The answer decides what stays and what cuts.

**Duplicate-claim tiebreakers (ask one per high-value duplicate):**
> You claim `<X>` in `<places>`. Pick one: which placement should carry that claim and the others get cut?

**Role identity (if stacked titles detected):**
> Between `<stacked titles>` — if you had to pick the single title that best signals what you charge for, which is it? The others become demonstrated in the assignments.

**Cut candidates (if role-soup or claim-without-evidence detected):**
> These sections are pure labels without evidence: `<list>`. Proposal: cut entirely and let the assignments do the work. OK, or is there a reason any of these must stay as a label?

**Don't ask:** "What are your strengths?", "What are you passionate about?", "What sets you apart?" — these are generic CV-advice questions that the document itself already answers. Respect the user's time: read, then ask only what the document doesn't reveal.

---

## Output

### Phase 1 — Audit report

Produce this *before* the interview. Short, scannable, evidence-backed.

```
# CV Audit — <filename>

## Pattern 1: Stacked titles
- line 3: "Senior Software Consultant — Developer & Solution Architect" — 3 titles stacked
- line 4: "Lead developer, architect and project lead" — 3 titles stacked

## Pattern 2: Repeated claims
| Claim | Stated at |
| CTO of Dua Digital | lines 4, 19 |
| Remote worldwide | lines 5, 19 |
| ...

## Pattern 3: Role-soup
- line 83: "Roles:" list enumerates 6 titles (+CTO) → no evidence, cut candidate

## Pattern 4: Filler
- line 19: "Delivers as senior developer" → filler verb + claim-without-evidence

## Pattern 5: Claims without evidence
- line 19: "Full-stack consultant" — adjective, no anchor
- line 82: "Deep expertise in..." — flagged

## Pattern 6: Geography restated
- Bali / remote-worldwide appears on lines 5, 19

## Word count
Current: <N> words. Estimated after trim: <N/2> words.
```

### Phase 2 — Interview

2-4 questions, batched. Wait for answers before continuing.

### Phase 3 — Trim plan

Based on interview answers. One of:
- **Delete:** full section / line removals.
- **Merge:** fold duplicate claims into the single surviving instance.
- **Rewrite:** replace filler/claim-without-evidence with specific or remove.
- **Keep:** unchanged.

Present as a diff preview. Wait for approval.

### Phase 4 — Apply

On approval, edit the file in one pass. Commit is out of scope — skill returns with a diff summary; user decides when to commit.

---

## Tone for the audit itself

Be direct. "Line 4 stacks 3 titles" is better than "You might consider whether line 4 could be tightened". The user asked for an audit, not a therapy session. Evidence + recommendation — no hedging.

But: no judgment on the person. The document has drifted; the person hasn't failed. Audit the artifact.

---

## Stop conditions

- User says "stop" or "not now" mid-interview → stop, no edits.
- User disagrees with a finding → note, skip that finding, don't re-argue.
- If the document already passes (rare but possible) → say so and exit. "Nothing to trim — this reads tight."
