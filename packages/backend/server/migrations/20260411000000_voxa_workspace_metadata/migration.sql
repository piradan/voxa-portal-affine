-- AddColumn: voxa integration metadata on workspaces
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "voxa_tenant_id"      VARCHAR,
  ADD COLUMN IF NOT EXISTS "voxa_workspace_type"  VARCHAR;

CREATE INDEX IF NOT EXISTS "workspaces_voxa_tenant_id_idx"
  ON "workspaces"("voxa_tenant_id");
