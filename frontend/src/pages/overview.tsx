import { Activity, ArrowUpRight, Bot, Circle, LayoutGrid } from "lucide-react";
import { Link } from "react-router";

const stats = [
  { label: "Active agents", value: "04", detail: "Ready to run", icon: Bot },
  { label: "Tasks completed", value: "128", detail: "This month", icon: Circle },
  { label: "Success rate", value: "98.4%", detail: "Across all runs", icon: Activity },
];

function OverviewPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#819087]">
          <LayoutGrid size={16} />
          <span>Workspace</span>
          <span className="text-[#c2c9c4]">/</span>
          <span className="font-medium text-[#425148]">Overview</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e7ebe7] bg-white px-3 py-1.5 text-[11px] text-[#627168]">
          <span className="size-1.5 rounded-full bg-[#83bd42]" />
          All systems operational
        </div>
      </header>

      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium tracking-[0.12em] text-[#7b8a80] uppercase">
            Workspace overview
          </p>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#18231e] sm:text-4xl">
            Good morning, Alex<span className="text-[#88b94f]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#758279]">
            Here&apos;s what&apos;s happening in your workspace today.
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

      <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Workspace statistics">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <article
            key={label}
            className="rounded-xl border border-[#e9ede9] bg-white p-5 shadow-[0_2px_8px_rgba(27,45,34,0.025)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#7b8980]">{label}</span>
              <Icon size={17} className="text-[#8b9b8e]" />
            </div>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-sans text-3xl font-semibold tracking-tight">{value}</span>
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
              Your workspace is ready
            </span>
            <h2 className="font-sans text-2xl font-semibold tracking-tight text-[#263b2b]">
              Put your agents to work.
            </h2>
            <p className="mt-2 max-w-xs text-xs leading-5 text-[#657b65]">
              Create an agent to start automating tasks and building a workflow that works for you.
            </p>
            <Link
              to="/agents"
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad9c0] bg-white/70 px-3 text-xs text-[#344b36] transition-colors hover:bg-white"
            >
              Explore agents
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
              <h2 className="font-sans text-sm font-semibold">Recent activity</h2>
              <p className="mt-1 text-[11px] text-[#89958d]">A snapshot of your workspace</p>
            </div>
            <ArrowUpRight size={16} className="text-[#76847a]" />
          </div>
          <div className="mt-5 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-[#e4e9e4] px-4 text-center">
            <span className="mb-2 flex size-8 items-center justify-center rounded-full bg-[#f1f5ee] text-[#819873]">
              <Activity size={16} />
            </span>
            <p className="text-xs font-medium text-[#59675d]">Nothing to show just yet</p>
            <p className="mt-1 text-[10px] text-[#98a39b]">Your agent activity will appear here.</p>
          </div>
        </article>
      </section>
    </div>
  );
}

export default OverviewPage;
