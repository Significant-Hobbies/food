# Food

Food unifies the Protein Index catalog and Recipe Index collection. Canonical source is Significant-Hobbies/food; the target is food.significanthobbies.com. The owner selected Label Desk and the shared UI library 0.1.33.

The prepared Open Food Facts Parquet snapshot and its quality report are in data/food-quality.json. Community records remain unverified; exact flagged conflicts have no protein ranking. Recipes retain publisher estimates and original links.

Run `pnpm check`, `python3 test/test_off_parquet.py` and `pnpm docs:validate` for source qualification. Deployment is manual and guarded against dirty, unsynced or unqualified source. The running `/api/health` reports the actual version tag and source snapshot; GitHub issue #5 tracks delivery and runtime proof. Historical data/ref recovery is retained without restoring the former retired services.

13 November 2026: comparison headings and the mobile selector support server-side ascending/descending sorting across pages. Product rows/cards open details. Country scope remains India-tagged products by owner choice.

Sorting follow-up checks: 359 unit and 83 Worker tests pass, including covering-index plans, non-comparable serving bases and deterministic duplicate-machine evidence. Default density page remains 25 D1 rows read for 25 products. Delayed-request interaction and phone/tablet/desktop checks pass. Independent review and live release proof are tracked in PR #10.

13 November 2026: the public Food interface accepts Open Food Facts as its default nutrition source. Ordinary rows/cards omit repeated unverified labels, and details show source attribution. Missing/conflict states, source dates and internal evidence records remain available.
