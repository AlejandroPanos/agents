import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Bot, LoaderCircle } from "lucide-react";
import { Link } from "react-router";
import { getApiErrorMessage, listAllAgents } from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";

// Page component for displaying the list of agents.
function AgentsPage() {
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents,
    queryFn: listAllAgents,
  });
  const agents = agentsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#819087]">
          <Link to="/" className="transition-colors hover:text-[#425148]">
            Workspace
          </Link>
          <span className="text-[#c2c9c4]">/</span>
          <span className="font-medium text-[#425148]">Agents</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e7ebe7] bg-white px-3 py-1.5 text-[11px] text-[#627168]">
          {agentsQuery.isLoading ? (
            <LoaderCircle size={13} className="animate-spin text-[#7b8a80]" />
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-[#83bd42]" />
              {agents.length} {agents.length === 1 ? "agent" : "agents"}
            </>
          )}
        </div>
      </header>

      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium tracking-[0.12em] text-[#7b8a80] uppercase">
            Your workspace
          </p>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#18231e] sm:text-4xl">
            Agents<span className="text-[#88b94f]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#758279]">Manage the agents that help get work done.</p>
        </div>
        <div className="rounded-lg border border-[#e3e9e3] bg-white px-3 py-2 text-xs text-[#647268]">
          {agentsQuery.isLoading
            ? "Loading…"
            : `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`}
        </div>
      </section>

      {agentsQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[#e9ede9] bg-white px-5 py-12 text-sm text-[#7b8980]">
          <LoaderCircle size={17} className="animate-spin" />
          Loading your agents…
        </div>
      )}

      {agentsQuery.isError && (
        <div
          className="rounded-xl border border-[#f0d7d1] bg-[#fff8f6] px-5 py-4 text-sm text-[#944c3b]"
          role="alert"
        >
          {getApiErrorMessage(agentsQuery.error, "Could not load your agents. Please try again.")}
        </div>
      )}

      {agentsQuery.isSuccess && agents.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#dfe6df] bg-white px-5 py-12 text-center">
          <Bot size={24} className="mx-auto mb-3 text-[#8b9b8e]" />
          <h2 className="font-sans text-sm font-semibold text-[#405046]">No agents yet</h2>
          <p className="mt-1 text-xs text-[#839087]">
            Create an agent to start building your workspace.
          </p>
        </div>
      )}

      {agentsQuery.isSuccess && agents.length > 0 && (
        <section className="space-y-3" aria-label="Your agents">
          {agents.map((agent) => (
            <article
              key={agent.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-[#e9ede9] bg-white p-4 shadow-[0_2px_8px_rgba(27,45,34,0.025)] sm:p-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eff4e9] text-[#688452]">
                <Bot size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-sans text-sm font-semibold text-[#28352d]">{agent.name}</h2>
                  <span className="rounded-full bg-[#eff4e9] px-2 py-1 text-[10px] capitalize text-[#5b7448]">
                    {agent.provider}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#839087]">
                  {agent.description || "No description provided."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#96a198]">
                  <span>Model: {agent.model}</span>
                  <span>Created {new Date(agent.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <Link
                to={`/agents/${agent.id}`}
                aria-label={`Open ${agent.name}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#87948b] transition-colors hover:bg-[#f3f6f2] hover:text-[#344b36]"
              >
                <ArrowUpRight size={17} />
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default AgentsPage;
