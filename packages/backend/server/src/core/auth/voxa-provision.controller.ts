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

import { Models } from '../../models';
import { WorkspaceBlobStorage } from '../storage';
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

@Controller('/api/voxa')
export class VoxaProvisionController {
  private readonly logger = new Logger(VoxaProvisionController.name);

  constructor(
    private readonly models: Models,
    private readonly docWriter: DocWriter,
    private readonly blobStorage: WorkspaceBlobStorage
  ) {}

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

    // If a tenant logo URL was provided, download and set as workspace avatar
    if (tenantLogoUrl) {
      try {
        const avatarKey = await this.downloadAndStoreAvatar(workspace.id, tenantLogoUrl);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.models.workspace.update(workspace.id, { avatarKey } as any, false);
      } catch (err) {
        this.logger.warn(`Failed to set workspace avatar from logo URL: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Provisioned ${type} workspace ${workspace.id} for entity ${voxaEntityId} (tenant ${voxaTenantId})`
    );

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
   * Downloads an image from a remote URL and stores it as a workspace blob.
   * Returns the blob key (avatarKey) to set on the workspace.
   */
  private async downloadAndStoreAvatar(workspaceId: string, url: string): Promise<string> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching logo`);

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());

    // Use a stable key derived from the URL so re-provisioning the same tenant
    // doesn't create duplicate blobs.
    const key = `avatar-${Buffer.from(url).toString('base64url').slice(0, 32)}`;
    // Note: blobStorage.put() auto-detects content type from buffer magic bytes
    void contentType; // detected from buffer
    await this.blobStorage.put(workspaceId, key, buffer);
    return key;
  }
}
