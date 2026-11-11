import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, Bot, Hash, LoaderCircle } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { getAgent, getApiErrorMessage } from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";
import EditAgentModal from "./edit-agent";

function AgentDetailPage() {
  const { agentId } = useParams();
  const agentQuery = useQuery({
    queryKey: queryKeys.agent(agentId ?? ""),
    queryFn: () =>
      agentId
        ? getAgent(agentId)
        : Promise.reject(new Error("Agent ID is required.")),
    enabled: Boolean(agentId),
  });

  if (!agentId) {
    return <Navigate to="/agents" replace />;
  }

  if (agentQuery.isLoading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 py-24 text-sm text-[#7b8980]">
        <LoaderCircle size={17} className="animate-spin" />
        Loading agent…
      </div>
    );
  }

  if (agentQuery.isError) {
    if (
      axios.isAxiosError(agentQuery.error) &&
      agentQuery.error.response?.status === 404
    ) {
      return <Navigate to="/agents" replace />;
    }

    return (
      <div className="mx-auto max-w-6xl">
        <Link
          to="/agents"
          className="mb-6 inline-flex items-center gap-2 text-xs text-[#647268] hover:text-[#344b36]"
        >
          <ArrowLeft size={14} />
          All agents
        </Link>
        <div
          className="rounded-xl border border-[#f0d7d1] bg-[#fff8f6] px-5 py-4 text-sm text-[#944c3b]"
          role="alert"
        >
          {getApiErrorMessage(
            agentQuery.error,
            "Could not load this agent. Please try again.",
          )}
        </div>
      </div>
    );
  }

  const agent = agentQuery.data;
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
          <span className="truncate font-medium text-[#425148]">
            {agent.name}
          </span>
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
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#18231e] sm:text-4xl">
            {agent.name}
            <span className="text-[#88b94f]">.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758279]">
            {agent.description || "No description provided."}
          </p>
        </div>
        <EditAgentModal agent={agent} />
      </section>

      <section
        className="mb-6 grid gap-3 sm:grid-cols-3"
        aria-label="Agent configuration"
      >
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#7b8980]">
            Provider
            <Activity size={17} className="text-[#8b9b8e]" />
          </div>
          <p className="mt-5 font-sans text-xl font-semibold capitalize text-[#28352d]">
            {agent.provider}
          </p>
          <p className="mt-1 text-[10px] text-[#93a097]">Model provider</p>
        </article>
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#7b8980]">
            Model
            <Bot size={17} className="text-[#8b9b8e]" />
          </div>
          <p className="mt-5 break-all font-sans text-lg font-semibold text-[#28352d]">
            {agent.model}
          </p>
          <p className="mt-1 text-[10px] text-[#93a097]">Selected model</p>
        </article>
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#7b8980]">
            Maximum tokens
            <Hash size={17} className="text-[#8b9b8e]" />
          </div>
          <p className="mt-5 font-sans text-3xl font-semibold tracking-tight text-[#28352d]">
            {agent.max_tokens.toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] text-[#93a097]">
            Temperature {agent.temperature}
          </p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5 sm:p-6">
          <h2 className="font-sans text-sm font-semibold text-[#28352d]">
            System instructions
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#758279]">
            {agent.system_prompt}
          </p>
        </article>
        <article className="rounded-xl border border-[#e9ede9] bg-white p-5 sm:p-6">
          <h2 className="font-sans text-sm font-semibold text-[#28352d]">
            Agent information
          </h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="flex items-center gap-2 text-[#89958d]">
                <Hash size={14} />
                Agent ID
              </dt>
              <dd className="truncate font-mono text-[11px] text-[#526157]">
                {agent.id}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#edf0ed] pt-3 text-xs">
              <dt className="text-[#89958d]">Created</dt>
              <dd className="text-right font-medium text-[#526157]">
                {new Date(agent.created_at).toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#edf0ed] pt-3 text-xs">
              <dt className="text-[#89958d]">Last updated</dt>
              <dd className="text-right font-medium text-[#526157]">
                {new Date(agent.updated_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  );
}

export default AgentDetailPage;
