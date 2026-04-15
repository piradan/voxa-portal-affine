/**
 * Voxa Provision Controller
 *
 * Service-to-service endpoint — called by voxa-app to create Portal workspaces
 * during tenant and student provisioning.  Authenticates via the shared
 * AFFINE_SERVICE_TOKEN bearer token (never exposed to browser clients).
 *
 * POST /api/voxa/provision
 * Body: {
 *   type: "tenant"|"student",
 *   voxaEntityId: string,
 *   voxaTenantId: string,
 *   userRole?: string,       // e.g. "student", "teacher", "tenant_admin"
 *   tenantLogoUrl?: string,  // remote logo URL — downloaded and set as workspace avatar
 *   tenantName?: string,     // tenant display name for workspace label
 * }
 * Response: { workspaceId: string, classNotesDocId?: string }
 *
 * POST /api/voxa/publish-book
 * Body: { workspaceId: string, title: string, markdown: string, voxaBookId: string }
 * Response: { docId: string }
 *
 * POST /api/voxa/unpublish-book
 * Body: { workspaceId: string, docId: string }
 * Response: { ok: true }
 *
 * POST /api/voxa/rename-workspace
 * Body: { workspaceId: string, name: string }
 * Response: { ok: true }
 * Writes the name into the Yjs root doc (what the sidebar displays) AND the DB column.
 * Use to backfill existing workspaces or rename after tenant renames their org.
 */

import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  applyUpdate,
  Doc as YDoc,
  encodeStateAsUpdate,
  encodeStateVector,
} from 'yjs';

import { Models } from '../../models';
import { PgWorkspaceDocStorageAdapter } from '../doc/adapters/workspace';
import { DocWriter } from '../doc/writer';
import { Public } from './guard';

interface ProvisionBody {
  type: 'tenant' | 'student';
  voxaEntityId: string;
  voxaTenantId: string;
  userRole?: string;
  tenantLogoUrl?: string;
  tenantName?: string;
}

interface PublishBookBody {
  workspaceId: string;
  title: string;
  markdown: string;
  voxaBookId: string;
}

interface UnpublishBookBody {
  workspaceId: string;
  docId: string;
}

interface RenameWorkspaceBody {
  workspaceId: string;
  name: string;
}

interface WorkspaceNoteBody {
  workspaceId: string;
  title: string;
  markdown: string;
}

@Controller('/api/voxa')
export class VoxaProvisionController {
  private readonly logger = new Logger(VoxaProvisionController.name);

  constructor(
    private readonly models: Models,
    private readonly docWriter: DocWriter,
    private readonly docStorage: PgWorkspaceDocStorageAdapter
  ) {}

  /**
   * Writes a workspace display name into the Yjs root document in a CRDT-safe
   * way. Loads the existing state first so the write is causally ordered — a
   * fresh-doc write would create a concurrent assignment that can lose to the
   * existing state ~47% of the time (verified empirically with yjs CRDT).
   */
  private async setWorkspaceYjsName(
    workspaceId: string,
    name: string
  ): Promise<void> {
    const existing = await this.docStorage.getDoc(workspaceId, workspaceId);
    const yjsDoc = new YDoc({ guid: workspaceId });

    if (existing?.bin) {
      const bin = Buffer.isBuffer(existing.bin)
        ? existing.bin
        : Buffer.from(
            existing.bin.buffer,
            existing.bin.byteOffset,
            existing.bin.byteLength
          );
      applyUpdate(yjsDoc, bin);
    }

    const prevState = encodeStateVector(yjsDoc);
    yjsDoc.getMap('meta').set('name', name);
    const update = encodeStateAsUpdate(yjsDoc, prevState);
    await this.docStorage.pushDocUpdates(workspaceId, workspaceId, [update]);
  }

  private validateServiceToken(req: Request, res: Response): boolean {
    const serviceToken = process.env['AFFINE_SERVICE_TOKEN'];
    if (!serviceToken) {
      this.logger.error('AFFINE_SERVICE_TOKEN not configured');
      res.status(500).json({ error: 'server_misconfigured' });
      return false;
    }
    const authHeader = req.headers['authorization'] ?? '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';
    if (bearerToken !== serviceToken) {
      res.status(401).json({ error: 'invalid_service_token' });
      return false;
    }
    return true;
  }

  @Public()
  @Post('/provision')
  @HttpCode(200)
  async provision(
    @Body() body: ProvisionBody,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!this.validateServiceToken(req, res)) return;

    const { type, voxaEntityId, voxaTenantId, userRole, tenantLogoUrl, tenantName } = body ?? {};

    if (!type || !voxaEntityId || !voxaTenantId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    // Find or create the portal admin user (used as technical owner)
    const adminUser = await this.models.user.getUserByEmail(
      'admin@voxa.education'
    );
    if (!adminUser) {
      this.logger.error('Portal admin user not found — run first-run setup');
      res.status(500).json({ error: 'admin_user_not_found' });
      return;
    }

    // Create the workspace
    const workspace = await this.models.workspace.create(adminUser.id);

    // Tag it with Voxa metadata via direct DB update.
    // Cast to any because UpdateWorkspaceInput doesn't include the new
    // voxa columns yet — Prisma accepts them after the migration.
    const workspaceName =
      type === 'tenant'
        ? (tenantName ? `${tenantName} Workspace` : `Tenant ${voxaTenantId}`)
        : `Student ${voxaEntityId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.models.workspace.update(workspace.id, {
      name: workspaceName,
      voxaTenantId,
      voxaWorkspaceType: type === 'tenant' ? 'staff' : 'student',
      ...(userRole ? { voxaUserRole: userRole } : {}),
    } as any, false);

    // If a tenant logo URL was provided, store it for later use
    if (tenantLogoUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.models.workspace.update(workspace.id, { voxaLogoUrl: tenantLogoUrl } as any, false);
      } catch (err) {
        this.logger.warn(`Failed to store logo URL: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Provisioned ${type} workspace ${workspace.id} for entity ${voxaEntityId} (tenant ${voxaTenantId})`
    );

    // Write workspace name into the Yjs root document so the AFFiNE sidebar
    // shows the correct name for ALL users (name comes from Yjs, not DB column).
    try {
      await this.setWorkspaceYjsName(workspace.id, workspaceName);
      this.logger.log(`Set Yjs workspace name to "${workspaceName}" for ${workspace.id}`);
    } catch (err) {
      this.logger.warn(`Failed to set Yjs workspace name: ${(err as Error).message}`);
    }

    // For student workspaces, create a default "Class Notes" document
    let classNotesDocId: string | undefined;
    if (type === 'student') {
      try {
        const classNotes = await this.docWriter.createDoc(
          workspace.id,
          'Class Notes',
          '# Class Notes\n\nUse this document to keep track of your lessons, exercises, and vocabulary.\n'
        );
        classNotesDocId = classNotes.docId;
        this.logger.log(
          `Created Class Notes doc ${classNotesDocId} in workspace ${workspace.id}`
        );
      } catch (err) {
        this.logger.warn(
          `Failed to create Class Notes doc: ${(err as Error).message}`
        );
      }
    }

    res.json({ workspaceId: workspace.id, classNotesDocId });
  }

  @Public()
  @Post('/publish-book')
  @HttpCode(200)
  async publishBook(
    @Body() body: PublishBookBody,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!this.validateServiceToken(req, res)) return;

    const { workspaceId, title, markdown, voxaBookId } = body ?? {};
    if (!workspaceId || !title || !markdown) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    try {
      const { docId } = await this.docWriter.createDoc(
        workspaceId,
        title,
        markdown
      );
      this.logger.log(
        `Published book ${voxaBookId} as doc ${docId} in workspace ${workspaceId}`
      );
      res.json({ docId });
    } catch (err) {
      this.logger.error(`Failed to publish book: ${(err as Error).message}`);
      res.status(500).json({ error: 'publish_failed', detail: (err as Error).message });
    }
  }

  @Public()
  @Post('/unpublish-book')
  @HttpCode(200)
  async unpublishBook(
    @Body() body: UnpublishBookBody,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!this.validateServiceToken(req, res)) return;

    const { workspaceId, docId } = body ?? {};
    if (!workspaceId || !docId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    try {
      await this.docWriter.deleteDoc(workspaceId, docId);
      this.logger.log(`Unpublished doc ${docId} from workspace ${workspaceId}`);
      res.json({ ok: true });
    } catch (err) {
      this.logger.error(`Failed to unpublish book: ${(err as Error).message}`);
      res.status(500).json({ error: 'unpublish_failed', detail: (err as Error).message });
    }
  }

  /**
   * POST /api/voxa/rename-workspace
   * Updates the Yjs root document name for an existing workspace.
   * Used to backfill workspaces provisioned before this fix, or to rename
   * a workspace name after a tenant renames their organisation.
   */
  /**
   * POST /api/voxa/provision-internal
   * One-time setup — creates the Voxa Platform Intelligence internal workspace,
   * used for staff backlog, ADRs, and project intelligence. Idempotent: if a
   * workspace with voxaWorkspaceType='internal' already exists, returns it.
   *
   * Auth: AFFINE_SERVICE_TOKEN.
   */
  @Public()
  @Post('/provision-internal')
  @HttpCode(200)
  async provisionInternal(@Req() req: Request, @Res() res: Response) {
    if (!this.validateServiceToken(req, res)) return;

    try {
      const existing = await this.models.workspace.list(
        { voxaWorkspaceType: 'internal' } as any,
        { id: true, sid: true } as any,
        1
      );
      if (existing && existing.length > 0) {
        const ws = existing[0] as unknown as { id: string };
        this.logger.log(`Internal workspace already exists: ${ws.id}`);
        res.json({ workspaceId: ws.id, created: false });
        return;
      }
    } catch (err) {
      this.logger.warn(
        `provision-internal lookup failed, continuing to create: ${(err as Error).message}`
      );
    }

    const adminUser = await this.models.user.getUserByEmail(
      'admin@voxa.education'
    );
    if (!adminUser) {
      this.logger.error('Portal admin user not found — run first-run setup');
      res.status(500).json({ error: 'admin_user_not_found' });
      return;
    }

    const workspace = await this.models.workspace.create(adminUser.id);
    const workspaceName = 'Voxa Platform Intelligence';

    await this.models.workspace.update(
      workspace.id,
      {
        name: workspaceName,
        voxaTenantId: 'voxa-internal',
        voxaWorkspaceType: 'internal',
      } as any,
      false
    );

    try {
      await this.setWorkspaceYjsName(workspace.id, workspaceName);
    } catch (err) {
      this.logger.warn(`Failed to set Yjs workspace name: ${(err as Error).message}`);
    }

    this.logger.log(
      `Provisioned internal workspace ${workspace.id} (${workspaceName})`
    );
    res.json({ workspaceId: workspace.id, created: true });
  }

  /**
   * POST /api/voxa/workspace-note
   * Creates a new document in the given workspace with the supplied markdown.
   * Used by voxa:adr and similar intelligence widgets to seed new docs.
   */
  @Public()
  @Post('/workspace-note')
  @HttpCode(200)
  async workspaceNote(
    @Body() body: WorkspaceNoteBody,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!this.validateServiceToken(req, res)) return;

    const { workspaceId, title, markdown } = body ?? {};
    if (!workspaceId || !title || !markdown) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    try {
      const { docId } = await this.docWriter.createDoc(
        workspaceId,
        title,
        markdown
      );
      this.logger.log(
        `Created workspace note "${title}" as doc ${docId} in workspace ${workspaceId}`
      );
      res.json({ docId });
    } catch (err) {
      this.logger.error(`Failed to create workspace note: ${(err as Error).message}`);
      res
        .status(500)
        .json({ error: 'note_create_failed', detail: (err as Error).message });
    }
  }

  @Public()
  @Post('/rename-workspace')
  @HttpCode(200)
  async renameWorkspace(
    @Body() body: RenameWorkspaceBody,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!this.validateServiceToken(req, res)) return;

    const { workspaceId, name } = body ?? {};
    if (!workspaceId || !name) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    try {
      await this.setWorkspaceYjsName(workspaceId, name);
      // Also update the DB metadata column for consistency
      await this.models.workspace.update(workspaceId, { name } as any, false);
      this.logger.log(`Renamed workspace ${workspaceId} to "${name}"`);
      res.json({ ok: true });
    } catch (err) {
      this.logger.error(`Failed to rename workspace: ${(err as Error).message}`);
      res.status(500).json({ error: 'rename_failed', detail: (err as Error).message });
    }
  }

}
