// Express Request augmentation for the request actor resolved by
// `actorMiddleware` in `src/middleware/auth.ts`.
//
// The actor is attached to every request before route handlers run and is the
// single source of truth for "who is making this request" (board user, agent,
// or none). Company scoping and permission checks read this property.

declare global {
  namespace Express {
    interface Request {
      actor: RequestActor;
    }
  }
}

type RequestActorSource =
  | "local_implicit"
  | "session"
  | "board_key"
  | "agent_jwt"
  | "agent_key"
  | "none";

type RequestActor = {
  type: "board" | "agent" | "none";
  source: RequestActorSource;
  userId?: string;
  agentId?: string;
  companyId?: string;
  companyIds?: string[];
  isInstanceAdmin?: boolean;
  keyId?: string;
  runId?: string;
};

export {};
