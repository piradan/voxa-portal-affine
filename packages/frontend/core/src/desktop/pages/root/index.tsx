import { NotificationCenter } from '@affine/component';
import { AuthService, DefaultServerService } from '@affine/core/modules/cloud';
import { FrameworkScope, useLiveData, useService } from '@toeverything/infra';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { GlobalDialogs } from '../../dialogs';
import { CustomThemeModifier } from './custom-theme';
import { FindInPagePopup } from './find-in-page/find-in-page-popup';

/** Routes that are accessible without authentication */
const PUBLIC_PATHS = [
  '/sign-in',
  '/signIn',
  '/sign-In',
  '/magic-link',
  '/oauth/',
  '/auth/',
  '/invite/',
  '/open-app/',
  '/redirect-proxy',
  '/expired',
  '/desktop-signin',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const authService = useService(AuthService);
  const location = useLocation();
  const status = useLiveData(authService.session.status$);
  // Also wait for active revalidation to settle before redirecting
  const isRevalidating = useLiveData(authService.session.isRevalidating$);

  if (isRevalidating && status !== 'authenticated') {
    // Session check in progress — render nothing to avoid flash redirect
    return null;
  }

  if (status !== 'authenticated' && !isPublicPath(location.pathname)) {
    // Redirect to sign-in, preserving intended destination
    const redirectUri = encodeURIComponent(
      location.pathname + location.search
    );
    return <Navigate to={`/sign-in?redirect_uri=${redirectUri}`} replace />;
  }

  return <>{children}</>;
};

export const RootWrapper = () => {
  const defaultServerService = useService(DefaultServerService);
  const [isServerReady, setIsServerReady] = useState(false);

  useEffect(() => {
    if (isServerReady) {
      return;
    }
    const abortController = new AbortController();
    defaultServerService.server
      .waitForConfigRevalidation(abortController.signal)
      .then(() => setIsServerReady(true))
      .catch(console.error);
    return () => abortController.abort();
  }, [defaultServerService, isServerReady]);

  return (
    <FrameworkScope scope={defaultServerService.server.scope}>
      <GlobalDialogs />
      <NotificationCenter />
      <AuthGuard>
        <Outlet />
      </AuthGuard>
      <CustomThemeModifier />
      {BUILD_CONFIG.isElectron && <FindInPagePopup />}
    </FrameworkScope>
  );
};
