import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { App } from '../types.js';

const REQUEST_ID_HEADER = 'x-request-id';
/** Accept a proxy-supplied id only if it is short and boring, so it cannot inject into logs. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function generateRequestId(req: IncomingMessage): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

export function registerRequestId(app: App): void {
  app.addHook('onRequest', async (req, reply) => {
    reply.header(REQUEST_ID_HEADER, req.id);
  });
}
