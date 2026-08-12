# PR: feat(task3): lazy-load events from data/events.json using fs/promises

## What I built
- Implemented Task 3: moved event data into `data/events.json` and changed the server to lazy-load the file on the first `GET /events` request.
- Loading uses `node:fs/promises` with `async/await` and a `try/catch` to handle read failures.
- Added an in-memory cache `cachedEvents` to avoid repeated file reads.
- On read failure the server logs the error and responds with HTTP 500 and a JSON body. `/health` remains unaffected and returns 200.

## How to run
1. Install dependencies:

```bash
npm install
```

2. Type-check the project:

```bash
npm run typecheck
```

3. Start the dev server:

```bash
npm run dev
```

4. Test endpoints:

- Health check (should return 200 JSON):

```bash
curl http://localhost:3000/health
```

- Events (should return array of events):

```bash
curl http://localhost:3000/events
```

- Simulate missing data file (server must return 500 JSON and stay alive):

```bash
mv data/events.json data/events.json.bak
curl -i http://localhost:3000/events   # expect HTTP/1.1 500 and JSON body
curl http://localhost:3000/health      # expect 200
mv data/events.json.bak data/events.json
```

## Which parts were AI-assisted — and how I verified them
- AI-assisted: generation and edits to `src/server.ts` (lazy-loading logic, caching, async error handling) and creation of `todo.md` and `PR_BODY.md`.
- Verification performed locally by:
  - Running `npm run typecheck` (TypeScript checks pass).
  - Running the dev server (`npm run dev`) and using `curl` to test:
    - Normal `/events` path returns 200 + JSON
    - With file missing, `/events` returns 500 + JSON and the server continues to respond to `/health` with 200

## One concrete thing the agent (assistant) got wrong — and how it was caught
- Issue: The assistant initially tried to import `Event` from `src/domain.ts` while the interface in the file was named `Events` and was not exported; this caused a type/import error.
- How it was caught: Running `npm run typecheck` produced a TS error (TS2459). The fix was to export the correct interface and align imports. This demonstrates the importance of running the typechecker.

## Files changed (high level)
- `src/server.ts` — implement lazy async load, caching, error handling
- `src/domain.ts` — export the `Events` interface
- `data/events.json` — moved events data to JSON file
- `todo.md` — plan for Task 3
- `PR_BODY.md` — this PR description

## Acceptance checklist
- [x] `GET /events` returns JSON array when `data/events.json` exists
- [x] with `data/events.json` removed/renamed, `GET /events` logs error and returns HTTP 500 JSON
- [x] `GET /health` continues to return HTTP 200
- [x] `npm run typecheck` passes
- [x] `todo.md` plan is included in the PR

---

`Note for reviewers:` any function changed here may be used as a walkthrough example in the next session. Please review `src/server.ts` and `src/domain.ts` carefully.
