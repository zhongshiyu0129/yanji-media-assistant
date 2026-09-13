# Account Packages

Each folder under `accounts/` is a complete writing account package.

An account package owns the writing context used by a project:

- profile
- memory
- skills
- ideas
- facts
- compliance rules
- material usage policy

Projects select an account through `projects/<slug>/context/account.yaml`.

The first package, `default`, was migrated from the original top-level self-media assistant assets. Existing legacy paths remain available as fallback during this bridge phase.
