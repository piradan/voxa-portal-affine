/**
 * Voxa Provision Controller
 *
 * Service-to-service endpoint — called by voxa-app to create Portal workspaces
 * during tenant and student provisioning.  Authenticates via the shared
 * AFFINE_SERVICE_TOKEN bearer token (never exposed to browser clients).
 *
 * POST /api/voxa/provision
 * Body: { type: "tenant"|"student", voxaEntityId: string, voxaTenantId: string }
 * Response: { workspaceId: string }
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
import { Public } from './guard';

interface ProvisionBody {
  type: 'tenant' | 'student';
  voxaEntityId: string;
  voxaTenantId: string;
}

@Controller('/api/voxa')
export class VoxaProvisionController {
  private readonly logger = new Logger(VoxaProvisionController.name);

  constructor(private readonly models: Models) {}

  @Public()
  @Post('/provision')
  @HttpCode(200)
  async provision(
    @Body() body: ProvisionBody,
    @Req() req: Request,
    @Res() res: Response
  ) {
    // Validate service token
    const serviceToken = process.env['AFFINE_SERVICE_TOKEN'];
    if (!serviceToken) {
      this.logger.error('AFFINE_SERVICE_TOKEN not configured');
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }

    const authHeader = req.headers['authorization'] ?? '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';

    if (bearerToken !== serviceToken) {
      res.status(401).json({ error: 'invalid_service_token' });
      return;
    }

    const { type, voxaEntityId, voxaTenantId } = body ?? {};

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.models.workspace.update(workspace.id, {
      name:
        type === 'tenant'
          ? `Tenant ${voxaTenantId}`
          : `Student ${voxaEntityId}`,
      voxaTenantId,
      voxaWorkspaceType: type === 'tenant' ? 'staff' : 'student',
    } as any, false);

    this.logger.log(
      `Provisioned ${type} workspace ${workspace.id} for entity ${voxaEntityId} (tenant ${voxaTenantId})`
    );

    res.json({ workspaceId: workspace.id });
  }
}
