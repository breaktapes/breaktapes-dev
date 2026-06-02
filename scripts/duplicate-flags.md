# race_catalog duplicate flags

Audit of `race_catalog` on **staging** (`breaktapes-dev`, yqzycwuyhvzkbofwkazr), 2026-06-02.
Flag-only — nothing here is auto-deleted. Each "redundant ids" list keeps the lowest id, the rest are safe to delete.

Reproduce: see the two SQL queries at the bottom.

---

## 1. Exact same-year duplicates — same (name, city, country, year, dist)

**77 groups · 85 redundant rows.** These are true duplicates (identical race, year, AND distance).

### Triathlon (2)
| name | city | year | dist | keep | delete |
|---|---|---|---|---|---|
| 70.3 Subic Bay | Subic Bay Freeport Zone | 2026 | 70.3 / Middle Distance | 234 | **235** |
| 70.3 Valencia | Valencia | 2026 | 70.3 / Middle Distance | 247 | **248** |

### Literal "DUPLICATE"-named junk rows (4 groups — whole rows are flagged junk in source)
- `DUPLICATE Richmond Spring Riverside 10k and Half Marathon Run` — ids 12741/12742 (10K), 12767/12768 (Half)
- `Richmond Spring Riverside 10k and Half Marathon Run - DUPLICATE` — ids 12553/12554 (10K), 12531/12532 (Half)

### Running / HYROX / cycling (rest)
Redundant ids to delete (keep first of each pair/group):
Goa & multi-distance handled correctly (NOT flagged — different distances are legit). True dupes:
`235, 248, 18968, 18281, 12156, 12157, 18964, 19002, 555, 16451, 13028, 13029, 13030, 18706, 15125, 1214, 1359, 15067, 17056, 15514, 15515, 15516, 15517, 17163, 16951, 12742, 12768, 14241, 15081, 2357, 2354, 12519, 2526, 13809, 2797, 2843, 12990, 13093, 12853, 14818, 14398, 15148, 3691, 14194, 4064, 14275, 15038, 13813, 17777, 17729, 4978, 4979, 5062, 5061, 18559, 5168, 12554, 12532, 14573, 17319, 14351, 14558, 5591, 6030, 6029, 6144, 6148, 16616, 13294, 13316, 15079, 12587, 15284, 15603, 16874, 16073, 7894, 12490, 12515, 12651, 12652, 12693, 12694, 17481, 17022`

---

## 2. Variant duplicates — same race & year, split by sponsor / case / punctuation

Need name-canonicalization to detect. **Real ones** (genuine dupes):

| canonical | year | dist | variants | ids |
|---|---|---|---|---|
| Boston Marathon | 2026 | Marathon | "Boston Marathon" vs "…presented by Bank of America" | 1034, 17503 |
| Barfoot & Thompson Auckland Marathon | 2026 | Marathon | ± "presented by ASICS" | 8915, 18160 |
| Korat Marathon | 2025/26 | Marathon | sponsor variants (BYD / The Mall) | 12749/18062, 16861/17958 |
| EVA Air Marathon | 2026 | Marathon | "Eva Air" vs "EVA Air" | 16319, 18168 |
| FALKE Rothaarsteig Marathon | 2026 | Marathon | case | 10739, 15788 |
| Run For Planet | 2026 | 10K/5K | "for" vs "For" | 14438/14452, 5521/5522, 5523/5524 |
| Ras Al Khaimah Half Marathon | 2026 | Half | "al" vs "Al" | 5264, 19022 |
| SportScheck Run Nürnberg | 2026 | 10K/Half | "Run" vs "RUN" | 11113/15936, 11135/15977 |
| McDonald's Townsville Running Festival | 2026 | 10K/Half/Mar | "(McDonald's)" parenthetical | 8417/17063, 8470/17107, 8738/16768 |
| Bodhgaya Marathon Run for Global Peace | 2026 | Marathon | hyphen vs en-dash | 12557, 18750 |
| Athens Classic Marathon | 2025 | Marathon | 546, 555 |

## 3. NOT duplicates — excluded false positives

The canonical audit's punctuation-strip conflated **decimal distances**. These are DIFFERENT races, do NOT merge/delete:
`Bati'run 1.2K vs 12K`, `Beer Marathon 1.5K vs 15K`, `THP Winter 4.5K vs 45K`, `Transvulcania 7.3K vs 73K`,
`Trail de Terrides 1.2K vs 12K`, `Trail des Fées 1.2K vs 12K`, `Château de Verneuil 1.5K vs 15K`,
`Ultra Trail Forillon 2.5K vs 25K`, `New Glarus … 1.6K vs 16K`.

---

## Already fixed (this session)
- **Comrades Marathon** — was split Durban (73) + "Comrades" (6). 2021 renamed to Durban (gap), 2022-26 dupes deleted. Now one Durban group (74 rows). Staging only.

## Reproduce
```sql
-- 1. Exact same-year dupes
SELECT name, city, country, year, dist, count(*) n, array_agg(id ORDER BY id) ids
FROM race_catalog WHERE year IS NOT NULL
GROUP BY name, city, country, year, dist HAVING count(*) > 1 ORDER BY n DESC;

-- 2. Variant dupes (strips year/sponsor/championship/punct; review decimals manually)
-- see scripts/load-ironman-catalog.mjs canonicalizeName() for the IRONMAN-scoped version
```
