import { z } from "zod";

/**
 * Single validated view of server environment. Fails fast with a readable
 * message instead of undefined-at-runtime surprises.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 chars"),
    SIGNED_URL_SECRET: z.string().min(32, "SIGNED_URL_SECRET must be at least 32 chars"),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),

    STORAGE_DRIVER: z.enum(["supabase", "local"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default("./storage"),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("lumora"),

    EMAIL_DRIVER: z.enum(["smtp", "console"]).default("console"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default("LUMORA <no-reply@lumora.app>"),

    // ── Billing ──
    PAYMENT_DRIVER: z.enum(["dev", "xendit"]).default("dev"),
    XENDIT_SECRET_KEY: z.string().optional(),
    XENDIT_CALLBACK_TOKEN: z.string().optional(),
    PRICE_PER_SESSION_IDR: z.coerce.number().int().min(0).default(2000),
    LOW_BALANCE_THRESHOLD_IDR: z.coerce.number().int().min(0).default(20000),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "supabase" && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      });
    }
    if (env.EMAIL_DRIVER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "EMAIL_DRIVER=smtp requires SMTP_HOST" });
    }
    if (env.PAYMENT_DRIVER === "xendit" && (!env.XENDIT_SECRET_KEY || !env.XENDIT_CALLBACK_TOKEN)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PAYMENT_DRIVER=xendit requires XENDIT_SECRET_KEY and XENDIT_CALLBACK_TOKEN" });
    }
    // Dev payments must never reach a real deployment. Local prod builds
    // (next start on localhost) are fine — the tell is a public APP_URL.
    const isLocalhost = ["localhost", "127.0.0.1"].includes(new URL(env.APP_URL).hostname);
    if (env.PAYMENT_DRIVER === "dev" && env.NODE_ENV === "production" && !isLocalhost) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PAYMENT_DRIVER=dev is not allowed on a non-localhost deployment",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
