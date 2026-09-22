import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(100),
  ALLOWED_ORIGINS: z.string().default('*'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const formatted = JSON.stringify(result.error.format());
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }
  return result.data;
}

export const config = loadConfig();
