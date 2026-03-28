# Unity Owner Map

Current grounded mechanic owners recovered from the shipped CIFI Unity build:

- `TokenShop`
  - system: token bank / token upgrades
  - source owner: [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
  - parser: [`scripts/token_shop_parse.py`](C:\Users\Shadow\Desktop\CiFi\scripts\token_shop_parse.py)
  - outputs: [`docs/token-shop-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\token-shop-values.md), [`data/token-shop-values.json`](C:\Users\Shadow\Desktop\CiFi\data\token-shop-values.json)

- `MultiverseMarket`
  - system: Chrystos Emporium / Inscryptions
  - source owner: [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
  - parser: [`scripts/multiverse_market_parse.py`](C:\Users\Shadow\Desktop\CiFi\scripts\multiverse_market_parse.py)
  - outputs: [`docs/multiverse-market-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-values.md), [`data/multiverse-market-values.json`](C:\Users\Shadow\Desktop\CiFi\data\multiverse-market-values.json)

Next likely targets should follow the same pattern: find the real owner object first, then parse the serialized payload directly when typetree tooling fails.
