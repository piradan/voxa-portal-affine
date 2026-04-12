-- AddColumn: voxa user role and logo URL on workspaces
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "voxa_user_role"  VARCHAR,
  ADD COLUMN IF NOT EXISTS "voxa_logo_url"   VARCHAR;
