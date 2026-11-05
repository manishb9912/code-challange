import { buildApp } from './app.js';
import { ConfigError, loadConfigFromProcess } from './config/index.js';

const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  const config = loadConfigFromProcess();
  const app = await buildApp({ config });

  const shutdown = (signal: NodeJS.Signals) => {
    app.log.info({ signal }, 'shutting down: draining in-flight requests');
    // Hard stop if draining hangs, so the orchestrator is never blocked indefinitely.
    setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'error during shutdown');
        process.exit(1);
      },
    );
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  // The logger may not exist yet (bad config), so write directly to stderr.
  const message = error instanceof ConfigError ? error.message : String(error);
  process.stderr.write(`Failed to start API: ${message}\n`);
  process.exit(1);
});
