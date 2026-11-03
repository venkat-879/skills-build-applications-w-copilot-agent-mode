# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Keep the React app focused on routing, data fetching, and accessible loading/empty/error states. Reuse a small API client and render each capability from the server contract without business logic in the UI. The UI should display the canonical server payloads for activities, teams, leaderboard entries, and workout suggestions without adding hidden data rules.
- Logic tier decision: Build the Express API around typed route handlers and service-level validation so each endpoint returns deliberate 4xx responses for bad IDs, missing required fields, and unknown users rather than letting Mongoose cast errors leak as 500s. Route handlers must remain thin and delegate validation and business rules to dedicated service logic.
- Data tier decision: Define strict Mongoose schemas for User, Team, Activity, and Workout, with required fields, defaults for arrays, and seed logic that is idempotent and preserves unrelated records while creating the canonical OctoFit fixtures. Validation should reject empty names, missing emails, missing fitness goals, and incomplete activity metadata before data reaches the database.
- Activity tracking approach: Validate `userId` and `teamId` before creating an activity, ensure the referenced user/team exist, store `user` and `team` as IDs, and compute `points` and `occurredAt` server-side from the submitted `minutes` and type. The route should never trust client input for derived fields.
- Team management approach: Require a non-empty `name` and `mascot`, allow a `members` array with default `[]`, and keep member IDs as Mongoose ObjectIds so list/create responses expose consistent team membership data. When a seeded user is reassigned to a canonical team, existing unrelated membership records must stay intact.
- Leaderboard approach: Aggregate team totals from Activity documents, sum points by team, order highest-first, and assign 1-based ranks in the returned entry list. Any team without activity should be excluded until there is a computed total.
- Workout suggestions approach: Match a user by email, inspect that user's recent activity focus or fitness goal, and recommend workouts with the closest `focus` while including a human-readable `reason` that explains the match. Suggestions should be ordered from the strongest pattern match to weaker matches.
- Seed/data integrity approach: Seed scripts should use upserts for canonical demo data and reconcile any previous team membership for the seeded user rather than deleting or overwriting unrelated data. This keeps the starter app deterministic while allowing repeated runs in dev and CI.

## Test plan

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Fails when Mongoose validation is missing or incomplete; this is the first indicator that the schema contract is not yet enforcing required fields and defaults.
  - It verifies the minimum contract for users, teams, activities, and workouts before any API layer depends on them.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Fails when route handlers are unimplemented or return the wrong status codes, payload shapes, or ordering; this validates the REST contract for activities, teams, leaderboard, and workout suggestions.
  - It specifically checks 4xx behavior for invalid IDs and unknown users, successful creation/listing responses, leaderboard ordering, and workout recommendation matching.
- Frontend command: `npm test --prefix octofit-tracker/frontend`
  - Fails when the UI still renders placeholder content instead of fetching and displaying real API data; it also checks the required loading, empty, and error states and accessible alert semantics.
  - The tests verify that each route makes the expected fetch to `/api/*` and renders the returned data in a user-friendly way.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
  - Confirms the Express/TypeScript code compiles cleanly after the logic-tier fixes, with type errors surfacing before runtime behavior is validated.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  - Confirms the Vite/React app compiles successfully once the presentation layer is bound to the API contract and the fetch-driven UI is implemented.

The current failures indicate the intended order: start with the data contracts, then the API endpoints, then the React UI; each tier depends on the previous one to be correct and stable. Following that order minimizes rework and keeps each layer aligned with the shared OctoFit contract.
