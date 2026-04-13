import type { Configuration as RspackDevServerConfiguration } from '@rspack/dev-server';

export const RSPACK_SUPPORTED_PACKAGES = [
  '@affine/admin',
  '@affine/web',
  '@affine/mobile',
  '@affine/ios',
  '@affine/android',
  '@affine/electron-renderer',
  '@affine/server',
  '@affine/reader',
] as const;

const rspackSupportedPackageSet = new Set<string>(RSPACK_SUPPORTED_PACKAGES);

export function isRspackSupportedPackageName(name: string) {
  return rspackSupportedPackageSet.has(name);
}

export function assertRspackSupportedPackageName(name: string) {
  if (isRspackSupportedPackageName(name)) {
    return;
  }

  throw new Error(
    `Rspack bundling currently supports: ${Array.from(RSPACK_SUPPORTED_PACKAGES).join(', ')}. Unsupported package: ${name}.`
  );
}

const IN_CI = !!process.env.CI;
const httpProxyMiddlewareLogLevel = IN_CI ? 'silent' : 'error';

export const DEFAULT_DEV_SERVER_CONFIG: RspackDevServerConfiguration = {
  host: '0.0.0.0',
  port: 8084,
  allowedHosts: 'all',
  hot: false,
  liveReload: true,
  compress: !process.env.CI,
  setupExitSignals: true,
  client: {
    overlay: process.env.DISABLE_DEV_OVERLAY === 'true' ? false : undefined,
    logging: process.env.CI ? 'none' : 'error',
    // 'auto' makes the HMR client inherit protocol/host/port from the page URL.
    // This is required when accessed through a reverse proxy (Traefik) — the
    // explicit ws://host:8084 form bypasses the proxy and fails from outside.
    // Electron cannot use custom protocols for WebSocket, but we're self-hosted.
    webSocketURL: 'auto://0.0.0.0:0/ws',
  },
  historyApiFallback: {
    rewrites: [
      {
        from: /.*/,
        to: () => {
          return process.env.SELF_HOSTED === 'true'
            ? '/selfhost.html'
            : '/index.html';
        },
      },
    ],
  },
  proxy: [
    {
      context: '/api',
      target: 'http://localhost:3010',
      logLevel: httpProxyMiddlewareLogLevel,
    },
    {
      context: '/socket.io',
      target: 'http://localhost:3010',
      ws: true,
      logLevel: httpProxyMiddlewareLogLevel,
    },
    {
      context: '/graphql',
      target: 'http://localhost:3010',
      logLevel: httpProxyMiddlewareLogLevel,
    },
  ],
};
