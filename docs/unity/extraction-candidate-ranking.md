# Extraction Candidate Ranking

This scorer and its generated ranking snapshot were part of the pre-DB research workflow and are no longer part of the supported architecture.

Current owner boundary:

- [data/extraction-candidate-families.v1.json](data/extraction-candidate-families.v1.json) remains as historical extraction-family metadata
- DB-backed trace resolution, best-gap scoring, and reducer-owned missing-seam state now own active follow-up selection

If this capability is ever restored, it should return as a DB-native evidence-gap query rather than as a committed ranking snapshot.

