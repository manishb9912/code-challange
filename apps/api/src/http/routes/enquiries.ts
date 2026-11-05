import { EnquiryCreatedSchema, EnquirySchema } from '@catalogue/shared';
import type { EnquiryService } from '../../services/enquiry-service.js';
import type { App } from '../types.js';

export function enquiryRoutes(app: App, enquiries: EnquiryService, perMinute: number): void {
  app.post(
    '/enquiries',
    {
      // Replaces the global limit for this route with a much stricter per-IP one (protects the
      // inbox, the email budget and sender reputation). @fastify/rate-limit applies a single
      // limiter per request, so a longer (hourly/daily) window belongs at the edge (AWS WAF).
      config: { rateLimit: { max: perMinute, timeWindow: '1 minute' } },
      schema: {
        tags: ['enquiries'],
        summary: 'Send a product enquiry to the sales inbox',
        body: EnquirySchema,
        response: { 201: EnquiryCreatedSchema },
      },
    },
    async (req, reply) => {
      const created = await enquiries.submit(req.body);
      return reply.code(201).send(created);
    },
  );
}
