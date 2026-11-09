export type AgentStatus = "Active" | "Paused";

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  lastRun: string;
  runs: number;
}

export const agents: Agent[] = [
  {
    id: "research-assistant",
    name: "Research assistant",
    description: "Finds and summarizes information from your connected sources.",
    status: "Active",
    lastRun: "Ran 12 minutes ago",
    runs: 42,
  },
];
