import type { BridgeDevice } from "@lumora/db";
import type { SessionUser } from "@lumora/contracts";

/** Typed Hono context variables. */
export interface ApiVariables {
  user: SessionUser;
  bridgeDevice: BridgeDevice;
  ip: string;
}

export type ApiEnv = { Variables: ApiVariables };
