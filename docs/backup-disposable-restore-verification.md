# Disposable restore verification

The manually triggered backup workflow now starts an isolated PostgreSQL 17 service, restores the custom-format `public` and `private` schema dump using `pg_restore --exit-on-error`, and checks that `public.cards` contains rows. Only after successful restore does it upload the encrypted artifact. The workflow uses local disposable credentials for the restore, never the production connection URI.

**Caution:** Supabase-specific schema dependencies (for example auth/storage schemas, extensions, or Supabase-owned roles) may prevent a complete restore into stock PostgreSQL. In that case the workflow will fail closed and the artifact will not upload; investigate missing dependencies rather than disabling `--exit-on-error`. This is not a full Supabase project restore and does not cover auth users, storage objects, grants, or disaster recovery timing.

The previously downloaded encrypted backup was not restore-tested. To test the new workflow, run it manually after merging. Production migration remains on hold until restore passes.
