# Session 2 plan

- [x] Review project conventions and the contract for bookings/events pagination and filtering.
- [x] Add in-memory bookings resource with create/get/delete, using the service layer and HttpError rules.
- [x] Add validation middleware and query parsing for filtering + pagination on GET /v1/events.
- [x] Implement consistency pass across the API: one error middleware, no direct 500s in handlers, and correct status codes.
- [x] Verify with typecheck and lint, then test the real endpoints with PowerShell requests.
