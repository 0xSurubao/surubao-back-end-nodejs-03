import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(2828),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_SECONDS: z.coerce.number().int().min(60).default(1800),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1, 'Network passphrase required'),
  HORIZON_URL: z.string().url('HORIZON_URL must be a valid URL'),
  SOROBAN_RPC_URL: z.string().url('SOROBAN_RPC_URL must be a valid URL'),
  HOME_DOMAIN: z.string().min(1, 'HOME_DOMAIN is required'),
  WEB_AUTH_DOMAIN: z.string().min(1, 'WEB_AUTH_DOMAIN is required'),
  SEP10_SERVER_SK: z.string().min(1, 'SEP10_SERVER_SK required'),
  CONTRACT_IDS: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z
    .string()
    .min(1, 'FIREBASE_CLIENT_EMAIL is required')
    .email('FIREBASE_CLIENT_EMAIL must be a valid email'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
  COMMIT_SHA: z.string().optional(),
});

type EnvInput = z.infer<typeof EnvSchema>;

const parsed: EnvInput = EnvSchema.parse(process.env);

const normalizeContractIds = (input?: string) =>
  input
    ? input
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

export const env = {
  nodeEnv: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === 'production',
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  corsOrigin: parsed.CORS_ORIGIN,
  jwtSecret: parsed.JWT_SECRET,
  jwtExpiresSeconds: parsed.JWT_EXPIRES_SECONDS,
  stellarNetworkPassphrase: parsed.STELLAR_NETWORK_PASSPHRASE,
  horizonUrl: parsed.HORIZON_URL,
  sorobanRpcUrl: parsed.SOROBAN_RPC_URL,
  homeDomain: parsed.HOME_DOMAIN,
  webAuthDomain: parsed.WEB_AUTH_DOMAIN,
  sep10ServerSecret: parsed.SEP10_SERVER_SK,
  contractIds: normalizeContractIds(parsed.CONTRACT_IDS),
  firebaseProjectId: parsed.FIREBASE_PROJECT_ID,
  firebaseClientEmail: parsed.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: parsed.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
  commitSha: parsed.COMMIT_SHA,
};

export type Env = typeof env;
