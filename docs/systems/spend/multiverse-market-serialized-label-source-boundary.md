# Multiverse Market Serialized Label-Source Boundary

This note records one new repo-local evidence class checked after the settled Market/TextHandler/probe path: the checked UABEA field-table export for `MultiverseMarket`.

## Checked serialized export evidence

- Additional `MultiverseMarket` container fields recovered from the checked export:
  - `InscryptionCostList: List<BigDouble>`
  - `InscryptionAndCostRelations: Dictionary<int, BigDouble>`
  - `IDChecks: List<int>`
  - `inscryptions: List<MultiverseMarket+Inscryption>`
  - `InscryptionTupleList: List<MultiverseMarket+InscryptionTupleObject>`
- Nested row payload types recovered from the same export:
  - `MultiverseMarket|Inscryption`
    - `<ID>k__BackingField`
    - `<Cost>k__BackingField`
    - `<Level>k__BackingField`
    - `<MaxLevel>k__BackingField`
    - `<ISObject>k__BackingField`
    - `transform`
  - `MultiverseMarket|InscryptionTupleObject`
    - `<ID>k__BackingField`
    - `<Cost>k__BackingField`
    - `<Level>k__BackingField`
    - `<MaxLevel>k__BackingField`
    - `<ISObject>k__BackingField`

## Checked negative boundary

- This is distinct from the exhausted Market/TextHandler/probe path.
- The checked serialized export does not recover player-facing label fields such as:
  - `Name`
  - `Label`
  - `Title`
  - `Description`
  - `Text`
  - `LocalizationKey`
  - `StringId`
- The recovered payloads are structural row carriers only:
  - ids
  - costs
  - levels
  - max levels
  - GameObject pointers
  - one `transform` carrier on `MultiverseMarket|Inscryption`

Current grounded conclusion:

- the alternate serialized export is a real new repo-local evidence class
- it strengthens structural row-container recovery, not player-facing label recovery
- it does not help rows `69-74` join back to the settled ordered mapping as final player-facing identities
- rows `69-74` remain unresolved
- the canonical import-safe subset stays empty
