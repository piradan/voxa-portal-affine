/**
 * Voxa SSO Controller
 *
 * Accepts a short-lived HS256 JWT minted by voxa-app and exchanges it for an
 * AFFiNE portal session.  The token carries the Voxa user identity; this
 * controller does a get-or-create on the portal user table so first-time
 * visitors are auto-provisioned.
 *
 * Flow:
 *   voxa-app signs JWT → redirects browser to /api/voxa-sso?token=…
 *   → this controller verifies JWT, resolves/creates portal user
 *   → sets affine_session cookie → redirects browser to workspace or home
 */

import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as jose from 'jose';

import { Models } from '../../models';
import { Public } from './guard';
import { AuthService } from './service';

interface VoxaSsoPayload {
  sub: string;
  email: string;
  name?: string;
  tenantId: string;
  roles: string[];
  voxaWorkspaceType: 'staff' | 'student';
  workspaceId: string;
  aud: string | string[];
}

@Controller('/api/voxa-sso')
export class VoxaSsoController {
  private readonly logger = new Logger(VoxaSsoController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly models: Models
  ) {}

  @Public()
  @Get('/')
  async sso(
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!token) {
      res.status(400).json({ error: 'missing_token' });
      return;
    }

    const secret = process.env['PORTAL_JWT_SECRET'];
    if (!secret) {
      this.logger.error('PORTAL_JWT_SECRET is not set');
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }

    let payload: VoxaSsoPayload;
    try {
      const secretBytes = new TextEncoder().encode(secret);
      const { payload: raw } = await jose.jwtVerify(token, secretBytes, {
        audience: 'portal',
        algorithms: ['HS256'],
        clockTolerance: 10,
      });
      payload = raw as unknown as VoxaSsoPayload;
    } catch (err) {
      this.logger.warn(`Voxa SSO JWT verification failed: ${err}`);
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    if (!payload.email || !payload.sub) {
      res.status(400).json({ error: 'malformed_token' });
      return;
    }

    let user: { id: string };
    try {
      user = await this.models.user.fulfill(payload.email, {
        name: payload.name,
      });
    } catch (err) {
      this.logger.error(`Failed to get-or-create portal user: ${err}`);
      res.status(500).json({ error: 'user_provision_failed' });
      return;
    }

    try {
      await this.auth.setCookies(req, res, user.id);
    } catch (err) {
      this.logger.error(`Failed to set portal session cookies: ${err}`);
      res.status(500).json({ error: 'session_failed' });
      return;
    }

    // Redirect to the specific workspace if provided, otherwise home
    const destination = payload.workspaceId
      ? `/workspace/${payload.workspaceId}`
      : '/';

    this.logger.log(
      `Voxa SSO: user ${payload.email} → portal user ${user.id} → ${destination}`
    );

    res.redirect(302, destination);
  }
}
