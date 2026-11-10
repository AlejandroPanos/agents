export const queryKeys = {
  currentUser: ["auth", "current-user"] as const,
  models: ["models"] as const,
  agents: ["agents"] as const,
  agent: (agentId: string) => ["agents", agentId] as const,
};
