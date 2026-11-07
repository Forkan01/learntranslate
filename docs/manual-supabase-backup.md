# Free manual Supabase backup

This workflow is **manual only**, runs from the default branch after merge, and does not modify production.

## Setup (mobile-friendly)
1. Open GitHub repository Settings → Secrets and variables → Actions → New repository secret.
2. Add `SUPABASE_BACKUP_DATABASE_URL` using the **PostgreSQL connection URI** from Supabase Dashboard → Connect. Use a database connection URI with sufficient permissions to dump public and private schemas, **not** the Supabase HTTPS project URL or publishable API key. Prefer the session pooler URI if direct IPv6 connectivity is unavailable; require SSL. Do not share the URI in chat.
3. Add `SUPABASE_BACKUP_PASSPHRASE`: a unique randomly generated passphrase of 20+ characters. Keep it securely outside GitHub; losing it makes the artifact unrecoverable. Never put it in a public issue, PR, or logs.
4. GitHub → Actions → **Manual encrypted Supabase database backup** → Run workflow (main).
5. Confirm successful completion; download the `supabase-encrypted-backup` artifact from the run **within 1 day**. Store the encrypted file and passphrase separately in safe locations.

## Scope and limitations
- Dumps the `public` and `private` PostgreSQL schemas including table data, functions, triggers, RLS policies, and indexes present there. **Not a full Supabase project backup**: excludes `auth`, `storage`, roles, global privileges, secrets, files in object storage, and external services.
- `pg_restore --list` and the encryption round-trip verify readable archive structure and intact encryption, **not a real restore**. A restore into a disposable database must succeed before treating this as a validated recovery plan.
- `--no-owner --no-acl` improves portability but does not preserve ownership or grants. Review and recreate necessary grants during restore.
- Backup is encrypted before upload; metadata files contain object names and SHA-256 of plaintext but no card contents. GitHub Actions runners temporarily hold plaintext. Access to the workflow/artifact should be restricted to trusted repo collaborators.
- Actions artifacts expire and are not long-term backups. This workflow does not provide point-in-time recovery or automated daily backup.
- If any step fails, do not proceed with production migration.
- The database URI is a powerful credential; prefer a dedicated limited backup role if available, rotate exposed credentials, and avoid printing connection strings.

## Local decryption (only on trusted computer)
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in database.dump.enc -out database.dump
pg_restore --list database.dump
```
The passphrase is prompted by OpenSSL. To test recovery, restore the archive into an isolated PostgreSQL instance with matching extensions and schemas. **Do not restore into production.**

**Production migration remains on hold until a recoverable backup is verified and the owner approves the exact migration.**
