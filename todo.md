# Task 3 — Async data loading (plan)

- Update server to lazy-load events using `node:fs/promises` (done)
- Add caching for loaded events (done)
- Handle read failure: log error and respond 500 JSON (done)
- Run typecheck and start server to test endpoints (done)
- Simulate deleted file and verify 500 response and `/health` still 200 (done)

Notes:
- Implementation is on branch `feature/task3-async-load`.
- Tested locally with `curl` to verify success and error cases.
