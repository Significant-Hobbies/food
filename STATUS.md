# Food

Food unifies the Protein Index catalog and Recipe Index collection. Canonical source is Significant-Hobbies/food; the target is food.significanthobbies.com. The owner selected Label Desk and the shared UI library 0.1.33.

16 November 2026: prepared public newsletter and feedback controls using the installed shared footer, with Food's colors, source links and legal attribution. The same catalog identity and self-hosted runtime serve the public SPA and product HTML; local/operator pages never install capture. Consent starts unchecked, feedback retries preserve their submission identity, and native fallback posts cannot place email in a URL. Compiled phone/tablet/desktop controls pass with mocked transport. Normal owner binding, production release and durable capture/alert/report receipts remain separate acceptance checks.

The prepared Open Food Facts Parquet snapshot and its quality report are in data/food-quality.json. Community records remain unverified; exact flagged conflicts have no protein ranking. Recipes retain publisher estimates and original links.

16 November 2026: prepared App Health browser collection at the canonical Food origin with session identity. Local, operator and `fleet_qa=1` pages stay silent. Endpoint telemetry sends normalized summaries without deriving application logs from request traffic. Worker-rendered product HTML shares the browser configuration, with QA HTML bypassing edge cache and using `no-store`. The public content policy allows the required tracker and collector origins; operator routes retain their prior restrictions. Backend key binding, deployment and fresh accepted production receipts remain release checks.

Run `pnpm check`, `python3 test/test_off_parquet.py` and `pnpm docs:validate` for source qualification. Deployment is manual and guarded against dirty, unsynced or unqualified source. The running `/api/health` reports the actual version tag and source snapshot; GitHub issue #5 tracks delivery and runtime proof. Historical data/ref recovery is retained without restoring the former retired services.

13 November 2026: comparison headings and the mobile selector support server-side ascending/descending sorting across pages. Product rows/cards open details. Country scope remains India-tagged products by owner choice.

Sorting follow-up checks: 359 unit and 83 Worker tests pass, including covering-index plans, non-comparable serving bases and deterministic duplicate-machine evidence. Default density page remains 25 D1 rows read for 25 products. Delayed-request interaction and phone/tablet/desktop checks pass. Independent review and live release proof are tracked in PR #10.

13 November 2026: the public Food interface accepts Open Food Facts as its only packaged-food nutrition source. Ordinary rows/cards omit repeated unverified labels, and details show source attribution. Missing/conflict states, source dates and internal evidence records remain available.

13 November 2026: public catalog rendering is isolated from the operator bundle, recipe code/data loads on demand, and only the matching desktop/mobile layout mounts for each25-product page. Shared UI0.1.33 supplies buttons, inputs, native selects/dialog/disclosures, tables, responsive images and recipe errors. OFF thumbnails use100/200px variants with original-image fallback; first-screen images load eagerly. Search waits for a180ms pause while clearing immediately. `pnpm perf:budget` guards initial route JS/CSS and deferred routes.

13 November 2026: all reusable widgets in public and local operator screens now use shared UI0.1.33, including navigation/pagination, cards/badges/avatars, checkbox/radio groups, feedback and shared Sheet/Dialog/AlertDialog lifecycle. The UI audit enforces the boundary. Product details and source reporting are also deferred. This follow-up is prepared in PR #14; production qualification is separate.

13 November 2026: prepared migration0025 adds a nonunique product/nutrient lookup index. A local D1 regression calls the actual product detail query on10,000 nutrients and checks bounded row reads, complete output/trust preservation and replay safety. Production migration and invoice outcome remain unverified.
