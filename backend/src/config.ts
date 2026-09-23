import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(100),
  /** Per-client socket buffer above which data frames are skipped (conflated). */
  WS_SOFT_LIMIT_BYTES: z.coerce.number().int().positive().default(64 * 1024),
  /** Per-client socket buffer above which the client is disconnected with 1013. */
  WS_HARD_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  /** How long a client may stay above the soft limit before being disconnected. */
  WS_LAG_GRACE_MS: z.coerce.number().int().positive().default(5000),
  ALLOWED_ORIGINS: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (result.success && result.data.WS_SOFT_LIMIT_BYTES >= result.data.WS_HARD_LIMIT_BYTES) {
    throw new Error('Invalid environment configuration: WS_SOFT_LIMIT_BYTES must be below WS_HARD_LIMIT_BYTES');
  }
  if (!result.success) {
    const formatted = JSON.stringify(result.error.format());
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }
  return result.data;
}

export const config = loadConfig();
