import { FastifyInstance } from 'fastify';
import { MetadataService } from '../metadata.js';

export interface MetaRoutesOptions {
  metadata: MetadataService;
}

export async function metaRoutes(app: FastifyInstance, options: MetaRoutesOptions): Promise<void> {
  app.get('/pairs/meta', async () => {
    return options.metadata.getAll();
  });
}
