# ADR 001: Backend, Authentication, and Storage Infrastructure

## Status

Accepted

## Context

AssetHub needs persistent relational data, authenticated operational access, and media storage for assets. The early product team needs managed infrastructure with low setup and operational overhead, while future corporate ownership may require different identity and storage providers or a self-hosted environment.

The V2 domain has relational integrity, date-range availability, approval, scope-based access, and audit-history requirements. Those concerns must remain application and PostgreSQL concerns rather than becoming feature-level calls to a managed-provider SDK.

## Decision

AssetHub will initially use Supabase as managed infrastructure:

- Supabase PostgreSQL for persistent relational data;
- Supabase Auth for initial authentication; and
- Supabase Storage for asset media and files.

Supabase is the initial provider, not the application architecture. The application remains PostgreSQL-oriented and uses provider adapters at infrastructure boundaries.

```text
UI
  -> Feature
  -> Domain / application service
  -> Repository or provider boundary
  -> Supabase PostgreSQL, Auth, or Storage
```

Feature and UI code must not query Supabase directly. Future implementation may use Next.js Server Components, Server Actions, Route Handlers, or equivalent server boundaries, but provider SDK calls remain isolated behind the contracts described below.

## Why Supabase

- Managed PostgreSQL fits AssetHub's transactional, relational, reporting, and audit requirements.
- Managed Auth and Storage reduce pilot setup and operational overhead.
- PostgreSQL remains the core data technology, supporting a practical future migration to corporate or self-hosted PostgreSQL.
- Supabase's database Row Level Security (RLS) and Storage policies provide an additional enforcement layer when designed deliberately.

## Alternatives considered

### Convex + Clerk

Rejected for the initial direction. It would reduce early implementation work, but makes the canonical business-data model less PostgreSQL-oriented and introduces separate proprietary data and identity boundaries. That is a poorer fit for AssetHub's transactional availability, audit, reporting, and corporate-takeover requirements.

### PostgreSQL + Drizzle + external authentication

Deferred, not rejected. This remains a valid future corporate implementation, but requires the team to provision and operate PostgreSQL, authentication, media storage, and deployment integration immediately. Supabase provides those managed capabilities for the initial pilot without abandoning PostgreSQL portability. This ADR does **not** select Drizzle or any ORM.

## Consequences

- Future data slices may add Supabase dependencies only when needed; this ADR authorizes neither installation nor a project configuration.
- Repositories must expose domain-oriented operations rather than Supabase query builders to features.
- The initial operational convenience carries future migration work; adapter contracts, SQL migrations, and portable object keys are the mitigation.
- Supabase-only features must not become hidden feature dependencies without an approved architecture decision.

## Security model

AssetHub uses defense in depth:

1. UI uses capability awareness only for relevance and usability.
2. Server boundaries authenticate, authorize, validate input, and enforce domain constraints.
3. PostgreSQL/Supabase RLS provides data-level protection where appropriate.
4. Material changes create audit/history records.

RLS is a second enforcement layer, not a replacement for server-side authorization or application-level booking/approval rules. RLS must be enabled and explicitly reviewed for exposed application tables. Service-role credentials, database passwords, and other privileged secrets must never be exposed to browser code. A server-side privileged path, if one is needed, must be narrow, audited, and never treated as a general client bypass.

## Data-access boundary

Business data is modeled relationally in PostgreSQL. Domain/application services own business operations such as availability checks, request state transitions, approval eligibility, and audit writes. Repositories own data access and may initially use Supabase PostgreSQL. The UI and features consume typed domain/application contracts only.

Do not use Supabase client calls in feature components as a shortcut around repositories, server validation, or domain rules.

## Authentication boundary

The Slice 0 application contracts remain the public application identity boundary:

- `getCurrentSession()`
- `getCurrentUser()`
- `hasCapability()`

Supabase Auth may implement these contracts in the appropriate future slice. Feature code must not call Supabase Auth APIs directly. Server-side identity verification must use a verified provider claim/user response rather than trusting an unverified session payload. Authorization remains capability- and scope-based in application code; provider roles or claims are inputs, not the full policy model.

## Storage boundary

Binary media does not belong in ordinary relational fields. PostgreSQL stores media metadata and references, including media ID, owning entity, storage provider, bucket/container, object key, MIME type, file size, metadata, creation timestamp, and uploader/actor where relevant. The binary object lives in object storage.

An application-level storage contract must support upload, delete, resolving an object, and signed access URLs where required. Supabase Storage is the first implementation. Future implementations may use S3, corporate S3-compatible storage, MinIO, or another approved provider. Object keys must be provider-neutral and stable enough for migration.

Storage policies are part of the security model. Private asset media must use deliberate bucket/object policies and signed access where appropriate. Service keys bypass Storage RLS and therefore remain server-only.

## Future corporate takeover path

The intended migration paths are:

```text
Initial: Supabase PostgreSQL + Supabase Auth + Supabase Storage
Hybrid:  Supabase PostgreSQL + corporate SSO + corporate S3-compatible storage
Future:  corporate/self-hosted PostgreSQL + corporate SSO + corporate S3-compatible storage
```

An on-premise requirement should use an API or S3-compatible object-storage model, not direct dependencies on web-server filesystems, NAS paths, or developer machines. Feature-level application logic should remain unchanged during a provider migration; only adapters, deployment configuration, and data/object migration processes should change.

## Explicit non-goals

This decision does not:

- install Supabase packages or configure a Supabase project;
- create database schemas, tables, migrations, RLS policies, buckets, or storage policies;
- select an ORM, migration tool, hosting provider, or final corporate SSO provider;
- implement authentication, authorization, master data, asset media upload, or any Slice 1+ feature; or
- permit direct Supabase use from UI or feature code.

## References

- [Technical architecture](TECHNICAL_ARCHITECTURE.md)
- [Data model](DATA_MODEL.md)
- [Authentication and access](AUTH_AND_ACCESS.md)
- [State and data flow](STATE_AND_DATA_FLOW.md)
