# Development fixtures

Fixtures exist only to exercise local interface states before a persistent
backend is selected. They are not seed data, a database substitute, or a
production data source.

- Use V2 terminology and controlled-looking values.
- Keep fixture factories near the feature that consumes them.
- Do not include V1 financial, procurement, or event-management fields.
- Do not import fixtures into server mutations or production builds.
