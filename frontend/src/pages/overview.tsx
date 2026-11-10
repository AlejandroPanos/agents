import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  Cpu,
  Layers3,
  LoaderCircle,
  Network,
} from "lucide-react";
import { Link } from "react-router";
import { getApiErrorMessage, listAllAgents } from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";

function OverviewPage() {
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents,
    queryFn: listAllAgents,
  });
  const agents = agentsQuery.data ?? [];
  const hasAgents = agentsQuery.isSuccess && agents.length > 0;
  const hasNoAgents = agentsQuery.isSuccess && agents.length === 0;
  const recentAgents = [...agents]
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
    )
    .slice(0, 4);
  const providerCount = new Set(agents.map((agent) => agent.provider)).size;
  const modelCount = new Set(
    agents.map((agent) => `${agent.provider}:${agent.model}`),
  ).size;

  const stats = [
    {
      label: "Agents configured",
      value: agentsQuery.isSuccess ? agents.length.toString() : "—",
      detail: "In your workspace",
      icon: Bot,
    },
    {
      label: "Providers in use",
      value: agentsQuery.isSuccess ? providerCount.toString() : "—",
      detail: "Across your agents",
      icon: Network,
    },
    {
      label: "Models in use",
      value: agentsQuery.isSuccess ? modelCount.toString() : "—",
      detail: "Unique configurations",
      icon: Cpu,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#819087]">
          <Layers3 size={16} />
          <span>Workspace</span>
          <span className="text-[#c2c9c4]">/</span>
          <span className="font-medium text-[#425148]">Overview</span>
        </div>
        {agentsQuery.isSuccess && (
          <div className="flex items-center gap-2 rounded-full border border-[#e7ebe7] bg-white px-3 py-1.5 text-[11px] text-[#627168]">
            <span className="size-1.5 rounded-full bg-[#83bd42]" />
            Workspace data loaded
          </div>
        )}
      </header>

      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium tracking-[0.12em] text-[#7b8a80] uppercase">
            Workspace overview
          </p>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#18231e] sm:text-4xl">
            Your workspace<span className="text-[#88b94f]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#758279]">
            A live overview of the agents and configurations you have created.
          </p>
        </div>
        <Link
          to="/agents"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#172a21] px-4 font-sans text-xs text-white transition-colors hover:bg-[#263d30]"
        >
          View agents
          <ArrowUpRight size={14} />
        </Link>
      </section>

      {agentsQuery.isError && (
        <div
          className="mb-6 rounded-xl border border-[#f0d7d1] bg-[#fff8f6] px-5 py-4 text-sm text-[#944c3b]"
          role="alert"
        >
          {getApiErrorMessage(
            agentsQuery.error,
            "Could not load workspace data. Please try again.",
          )}
        </div>
      )}

      <section
        className="mb-6 grid gap-3 sm:grid-cols-3"
        aria-label="Workspace statistics"
      >
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <article
            key={label}
            className="rounded-xl border border-[#e9ede9] bg-white p-5 shadow-[0_2px_8px_rgba(27,45,34,0.025)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#7b8980]">{label}</span>
              {agentsQuery.isLoading ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin text-[#8b9b8e]"
                />
              ) : (
                <Icon size={17} className="text-[#8b9b8e]" />
              )}
            </div>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-sans text-3xl font-semibold tracking-tight">
                {value}
              </span>
              <span className="pb-1 text-[10px] text-[#93a097]">{detail}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <article className="relative min-h-64 overflow-hidden rounded-xl bg-[#e8f0df] p-6 sm:p-8">
          <div className="relative z-10 max-w-sm">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-medium text-[#587444]">
              <span className="size-1.5 rounded-full bg-[#8dbd52]" />
              {agentsQuery.isSuccess
                ? `${agents.length} ${agents.length === 1 ? "agent" : "agents"} configured`
                : "Agent workspace"}
            </span>
            <h2 className="font-sans text-2xl font-semibold tracking-tight text-[#263b2b]">
              {hasAgents
                ? "Your agents are ready."
                : hasNoAgents
                  ? "Put your agents to work."
                  : "Your workspace at a glance."}
            </h2>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#657b65]">
              {hasAgents
                ? "Review your agents and their configurations, or add another agent to your workspace."
                : hasNoAgents
                  ? "Create your first agent to start building a workflow that works for you."
                  : "See the agents and configurations in your workspace."}
            </p>
            <Link
              to="/agents"
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad9c0] bg-white/70 px-3 text-xs text-[#344b36] transition-colors hover:bg-white"
            >
              {hasAgents ? "Explore agents" : "View agents"}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="absolute -right-8 -bottom-24 size-64 rounded-full border border-[#cbdcbd]/80" />
          <div className="absolute -right-1 -bottom-16 size-48 rounded-full border border-[#cbdcbd]/80" />
          <div className="absolute right-8 -bottom-10 size-32 rounded-full border border-[#cbdcbd]/80" />
          <div className="absolute right-16 bottom-6 size-16 rounded-2xl border border-[#bdd3ad] bg-[#d7e7ca]/70" />
        </article>

        <article className="rounded-xl border border-[#e9ede9] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans text-sm font-semibold">
                Recently updated agents
              </h2>
              <p className="mt-1 text-[11px] text-[#89958d]">
                Sorted by most recent configuration update
              </p>
            </div>
            <Link
              to="/agents"
              aria-label="View all agents"
              className="flex size-8 items-center justify-center rounded-lg text-[#76847a] transition-colors hover:bg-[#f3f6f2]"
            >
              <ArrowUpRight size={16} />
            </Link>
          </div>

          {agentsQuery.isLoading && (
            <div className="mt-5 flex min-h-32 items-center justify-center gap-2 text-xs text-[#89958d]">
              <LoaderCircle size={15} className="animate-spin" />
              Loading agents…
            </div>
          )}

          {agentsQuery.isSuccess && recentAgents.length === 0 && (
            <div className="mt-5 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-[#e4e9e4] px-4 text-center">
              <span className="mb-2 flex size-8 items-center justify-center rounded-full bg-[#f1f5ee] text-[#819873]">
                <Bot size={16} />
              </span>
              <p className="text-xs font-medium text-[#59675d]">
                No agents yet
              </p>
              <p className="mt-1 text-[10px] text-[#98a39b]">
                Created agents will appear here.
              </p>
            </div>
          )}

          {agentsQuery.isSuccess && recentAgents.length > 0 && (
            <ul className="mt-4 divide-y divide-[#edf0ed]">
              {recentAgents.map((agent) => (
                <li key={agent.id} className="py-3 first:pt-1 last:pb-0">
                  <Link
                    to={`/agents/${agent.id}`}
                    className="flex items-center gap-3 rounded-md transition-colors hover:bg-[#fbfcfa]"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eff4e9] text-[#688452]">
                      <Bot size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[#405046]">
                        {agent.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] capitalize text-[#96a198]">
                        {agent.provider} · {agent.model}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-[#96a198]">
                      {new Date(agent.updated_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}

export default OverviewPage;
