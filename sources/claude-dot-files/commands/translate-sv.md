---
name: translate-sv
description: "Translate English content to idiomatic Swedish. Preserves Markdown/HTML structure, keeps brand and technical terms in English where that's Swedish tech convention, translates sentence-level for meaning (not word-level). Flags non-obvious translation choices for review. Triggers on: translate to swedish, translate sv, swedish version, sv translation."
source_id: dua-cv-tools
version: 1.0.0
---

# Translate → Swedish

Produce idiomatic Swedish from English source. Preserve voice, structure, and all non-text elements. Translate at the sentence/paragraph level — not word-by-word.

Swedish tech/consulting culture is comfortable with English loanwords (stack, backend, frontend, SDK, API). Trying to translate these produces awkward, bureaucratic Swedish. The rule: translate *concepts*, keep *terms*.

---

## When to use

- Producing a Swedish version of a CV, bio, product page, blog post, or landing page
- User says "translate to Swedish", "give me the Swedish version", "sv translation"
- You need sentence-level idiomatic Swedish, not Google Translate

Not for: quick one-off phrases (just translate inline), legal/contract text (needs a professional translator), content that doesn't exist yet (write in Swedish from scratch instead).

---

## The Job

1. **Read** the source file(s) the user points at.
2. **Produce** the Swedish version as a new file (default: `<name>.sv.<ext>`, or whatever the user specifies).
3. **Report** a short list of non-obvious translation choices made — loanwords kept, idiomatic reframing, ambiguity resolved.

The goal is a Swedish document that reads like it was written in Swedish, not translated into it.

---

## Translation rules

### 1. Preserve structure, translate text

- **Markdown**: all headings, lists, tables, code blocks, formatting (`**bold**`, `*italic*`, links) stay in their exact positions. Only the text strings inside translate.
- **Inline HTML**: tags, classes, IDs, `href`, `src`, `alt` values stay unchanged. Only visible text nodes translate.
- **Frontmatter**: translate the human-facing fields (`title`, `tagline`, `description`). Leave machine fields (`name`, `slug`, `draft`, dates, URLs) alone. A person's name is *not* translated.
- **Code blocks, shell commands, file paths**: never translated.

### 2. Keep English terms (Swedish tech convention)

Swedish tech/consulting speaks English freely. Translating these makes the text sound like a government form. Keep as-is:

- **Brand and product names**: CodeIgniter, Fortnox, Kraken, Staren, Dua Digital, React, Next.js, AWS, Django, Volvo, etc.
- **Generic tech terms established in Swedish usage**: stack, backend, frontend, API, SDK, ERP, POS, cloud, DevOps, CI/CD, microservices, onboarding, offboarding, pipeline, harness, agent, prompt, tooling, hosting
- **Role titles in informal use**: senior developer, solution architect, project lead, CTO, CEO — all fine in English in Swedish CVs (or the Swedish equivalent if you prefer — ask if unsure)
- **Technology terms that would become clunky**: "rewrite", "migration", "integration" — these have Swedish equivalents (`omskrivning`, `migrering`, `integrering`) that are *usable* — choose based on flow
- **Acronyms**: never translate

### 3. Translate these

Concepts with established Swedish idiom:

- "housing cooperatives" → **bostadsrättsföreningar** (or `BRF` in tech circles)
- "husband and dad" → **make och pappa** (or `man och pappa`)
- "co-founder" → **medgrundare** (or leave `co-founder` — Swedish tech uses both)
- "based in" → **baserad i** / **bor i**
- "clients" → **kunder** (in general) or **klienter** (specifically for consulting)
- "team of four" → **team på fyra**
- "relationship" (business) → **samarbete** (usually better than `relation`)
- "shipping" (software) → **levererat** / **skeppat** (Swedish tech uses both)
- "believe in" → **tror på**
- "happiest as" → **trivs bäst som**

### 4. Preserve voice

If the source is aphoristic, the translation is aphoristic. If it's terse, it stays terse. If it uses lowercase everywhere for design reasons, so does the translation.

Swedish-specific tonal rules:
- Swedish tolerates fragments in CV/bio contexts — don't pad them into full sentences
- Avoid over-formality (`ni` instead of `du`, `vänligen` when unneeded) — most modern Swedish copy uses `du` and omits `vänligen`
- Don't over-translate hedges: "Believe in removal over addition" → `Tror på borttagning framför tillägg` reads clean; don't expand to `Jag tror starkt på att ta bort saker istället för att lägga till.`

### 5. Cultural / national adaptations

- **Date format**: keep as-is unless user asks (Swedish uses `YYYY-MM-DD` or `DD/MM/YYYY`; don't reformat unless requested)
- **Geography**: `Bali` stays `Bali`, `Gothenburg` becomes `Göteborg` in Swedish
- **Company suffixes**: `AB` stays `AB`, `Inc.` stays `Inc.`, etc. — these are legal entities, not translatable
- **"Swedish"** as a descriptor: usually translates to `svensk` — but in a CV describing clients, you can drop it (a Swedish reader assumes Swedish clients unless stated otherwise)

### 6. Handle ambiguity

When a sentence has multiple valid Swedish renderings, pick the one that:
1. Reads most natural in Swedish tech/consulting prose
2. Preserves the original's voice (terse stays terse)
3. If tied, picks the shorter version

Then **flag the choice** in the translation report so the user can review.

---

## Output format

### The translated file

Write the file at the user-specified path (or default to `<source>.sv.<ext>`). Full, complete translation — no placeholders, no `[TODO]` markers, no English fallbacks unless the rule above applies.

### The report (short)

After writing the file, output a short report to the terminal:

```
Translated: <source path> → <output path>

Non-obvious choices:
- "housing cooperatives" → bostadsrättsföreningar (standard Swedish term)
- "3+ years; relationship ongoing" → "3+ år; samarbete pågår" (relationship → samarbete, not relation, to avoid personal-relationship reading)
- Kept "stack", "backend", "API", "MCP" in English per Swedish tech convention
- [anything else non-obvious]

Flag for review:
- "best briefs start specific" → "bästa briefs är specifika" — "brief" could also be "uppdragsbeskrivning" but that's bureaucratic
- [any other translation choice where a second pass might want different]

Word count: EN ~420 → SV ~430 (+2%)
```

Keep the report under 200 words. Do not include the full translation in the report — it's already written to the file.

---

## Stop conditions

- User says "stop" mid-job → stop, no file written.
- Source file doesn't exist or isn't readable → report and exit.
- Source has very little translatable content (e.g. all code) → say so and exit. "Nothing to translate — this file is 95% code."
- If you're asked to translate into any language other than Swedish — politely note the skill is Swedish-specific and suggest the general approach instead.
