# State and Data Flow

## Server truth
Server/database is authoritative for:
- asset status/location;
- booking availability;
- request state;
- approval state;
- master data;
- permissions.

## Client state
Use client state for ephemeral UI concerns such as open sheets, local filter controls, draft steps, and optimistic presentation only when safe.

## Mutations
Every mutation should:
1. validate input;
2. authenticate;
3. authorize;
4. check current domain constraints;
5. write atomically where required;
6. record audit/history when material;
7. return canonical updated state.

## Availability
Never rely only on a previously rendered “Available” badge when submitting a request. Re-check authoritative availability.
