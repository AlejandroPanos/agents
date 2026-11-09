import { Activity, ArrowLeft, Bot, Clock3, Hash } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { agents } from "../data/agents";

function AgentDetailPage() {
  const { agentId } = useParams();
  const agent = agents.find((item) => item.id === agentId);

  if (!agent) {
    return <Navigate to="/agents" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#819087]">
          <Link to="/" className="transition-colors hover:text-[#425148]">
            Workspace
          </Link>
          <span className="text-[#c2c9c4]">/</span>
          <Link to="/agents" className="transition-colors hover:text-[#425148]">
            Agents
          </Link>
          <span className="text-[#c2c9c4]">/</span>
          <span className="truncate font-medium text-[#425148]">{agent.name}</span>
        </div>
        <Link
          to="/agents"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#e3e9e3] bg-white px-3 text-xs text-[#526157] transition-colors hover:bg-[#f5f7f4]"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">All agents</span>
        </Link>
      </header>

      <section className="mb-8 flex flex-wrap items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#eff4e9] text-[#688452]">
          <Bot size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#18231e] sm:text-4xl">
              {agent.name}
              <span className="text-[#88b94f]">.</span>
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${
                agent.status === "Active"
                  ? "bg-[#eff7e8] text-[#5b7f43]"
                  : "bg-[#f1f3f1] text-[#79847c]"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  agent.status === "Active" ? "bg-[#83bd42]" : "bg-[#aab2ac]"
                }`}
              />
              {agent.status}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758279]">{agent.description}</p>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Agent statistics">
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#7b8980]">
            Status
            <Activity size={17} className="text-[#8b9b8e]" />
          </div>
          <p className="mt-5 font-sans text-xl font-semibold text-[#28352d]">{agent.status}</p>
          <p className="mt-1 text-[10px] text-[#93a097]">Current agent state</p>
        </article>
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#7b8980]">
            Total runs
            <Bot size={17} className="text-[#8b9b8e]" />
          </div>
          <p className="mt-5 font-sans text-3xl font-semibold tracking-tight text-[#28352d]">
            {agent.runs}
          </p>
          <p className="mt-1 text-[10px] text-[#93a097]">Runs recorded</p>
        </article>
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#7b8980]">
            Last run
            <Clock3 size={17} className="text-[#8b9b8e]" />
          </div>
          <p className="mt-5 font-sans text-xl font-semibold text-[#28352d]">{agent.lastRun}</p>
          <p className="mt-1 text-[10px] text-[#93a097]">Most recent activity</p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5 sm:p-6">
          <h2 className="font-sans text-sm font-semibold text-[#28352d]">About this agent</h2>
          <p className="mt-3 text-sm leading-6 text-[#758279]">{agent.description}</p>
        </article>
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5 sm:p-6">
          <h2 className="font-sans text-sm font-semibold text-[#28352d]">Agent information</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="flex items-center gap-2 text-[#89958d]">
                <Hash size={14} />
                Agent ID
              </dt>
              <dd className="truncate font-mono text-[11px] text-[#526157]">{agent.id}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#edf0ed] pt-3 text-xs">
              <dt className="text-[#89958d]">Status</dt>
              <dd className="font-medium text-[#526157]">{agent.status}</dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  );
}

export default AgentDetailPage;
