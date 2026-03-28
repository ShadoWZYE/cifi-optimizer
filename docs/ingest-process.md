# CIFI Data Ingest Process

## Purpose

Keep repository data reviewable, sourceable, and safe to use in the app.

The ingest process should prevent:
- accidental promotion of fictional values
- silent schema drift
- untraceable optimizer behavior

---

## Ingest principles

1. source first
2. schema second
3. app snapshot third

That means:
- verify the external source
- define the internal shape
- only then promote data into app-owned snapshots

---

## Preferred workflow

### 1. Collect source material
Examples:
- official public listings
- public wiki pages
- named community tools
- community-maintained sheets with clear provenance

### 2. Record provenance
For each imported table, record:
- source label
- source URL if public
- import date
- confidence note
- whether it is verified, derived, or community-tool data

### 3. Normalize into stable records
Map the raw data into app-owned fields that:
- use consistent naming
- are documented
- avoid mixing verified and invented values

### 4. Validate before promotion
Run:
- smoke tests
- schema checks
- manual review of changed records

### 5. Promote snapshot
Only after the above should a snapshot become active/default.

---

## Initial grounded priorities

For current MVP work, focus on:
- PlayerProfile grounding
- shard milestone definitions
- validation cases
- terminology consistency

---

## Review gates

A data update should not be promoted if:
- the source is unclear
- the data is fictional or speculative
- the schema change is undocumented
- the resulting module would emit misleading user-facing recommendations

---

## Temporary rule for incomplete systems

If data is incomplete:
- keep the structure
- mark the uncertainty
- prefer descriptive mode in the UI

Do not invent formulas just to make the feature look finished.