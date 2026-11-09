import { ArrowUpRight, Bot, Clock3 } from "lucide-react";
import { Link } from "react-router";

const agents = [
  {
    name: "Research assistant",
    description: "Finds and summarizes information from your connected sources.",
    status: "Active",
    lastRun: "Ran 12 minutes ago",
    runs: "42 runs",
  },
  {
    name: "Inbox triage",
    description: "Organizes incoming requests and drafts suggested responses.",
    status: "Active",
    lastRun: "Ran 1 hour ago",
    runs: "86 runs",
  },
  {
    name: "Release notes",
    description: "Turns recent changes into clear, reader-friendly release notes.",
    status: "Paused",
    lastRun: "Ran yesterday",
    runs: "18 runs",
  },
];

function AgentsPage() {
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
          <span className="size-1.5 rounded-full bg-[#83bd42]" />
          2 active
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
          <p className="mt-2 text-sm text-[#758279]">
            Manage the agents that help get work done.
          </p>
        </div>
        <div className="rounded-lg border border-[#e3e9e3] bg-white px-3 py-2 text-xs text-[#647268]">
          3 agents
        </div>
      </section>

      <section className="space-y-3" aria-label="Your agents">
        {agents.map((agent) => (
          <article
            key={agent.name}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-[#e9ede9] bg-white p-4 shadow-[0_2px_8px_rgba(27,45,34,0.025)] sm:p-5"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eff4e9] text-[#688452]">
              <Bot size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-sans text-sm font-semibold text-[#28352d]">{agent.name}</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] ${
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
              <p className="mt-1 text-xs text-[#839087]">{agent.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#96a198]">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={12} />
                  {agent.lastRun}
                </span>
                <span>{agent.runs}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Open ${agent.name}`}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#87948b] transition-colors hover:bg-[#f3f6f2] hover:text-[#344b36]"
            >
              <ArrowUpRight size={17} />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

export default AgentsPage;