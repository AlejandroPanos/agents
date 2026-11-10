import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Command, House, LoaderCircle, LogOut, Plus } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import NewAgentModal from "../../pages/new-agent";
import { getApiErrorMessage, logout, type UserProfile } from "../../helpers/helpers";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../ui/button";

const navigation = [
  { label: "Overview", to: "/", icon: House, end: true },
  { label: "Agents", to: "/agents", icon: Bot, end: false },
];

export function Sidebar({ user }: { user: UserProfile }) {
  const [isNewAgentOpen, setIsNewAgentOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.currentUser, null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      navigate("/login", { replace: true });
    },
  });
  const displayName = user.name || user.email || "User";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  const logoutError = logoutMutation.isError
    ? getApiErrorMessage(logoutMutation.error, "Could not log out. Please try again.")
    : "";

  return (
    <>
      <aside className="flex w-19 shrink-0 flex-col bg-[#14251e] px-3 py-5 text-white sm:w-64 sm:px-5">
        <Link to="/" className="mb-6 flex items-center gap-3 px-1" aria-label="Agents home">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#c4f06b] text-[#17271f]">
            <Command size={22} />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block font-sans text-base font-semibold tracking-tight">
              fieldwork
            </span>
            <span className="mt-0.5 block text-[10px] tracking-[0.18em] text-white/45 uppercase">
              Agent workspace
            </span>
          </span>
        </Link>

        <Button
          type="button"
          aria-label="Create new agent"
          onClick={() => setIsNewAgentOpen(true)}
          className="mb-7 h-10 w-full justify-center gap-2 rounded-lg bg-[#c4f06b] px-2 text-[11px] font-semibold text-[#17271f] hover:bg-[#d2f68a] sm:justify-start sm:px-3"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Create new agent</span>
        </Button>

        <div className="mb-3 hidden px-2 text-[10px] font-medium tracking-[0.18em] text-white/40 uppercase sm:block">
          Workspace
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                `flex h-10 w-full items-center justify-center gap-3 rounded-lg px-2 text-[11px] transition-colors sm:justify-start sm:px-3 ${
                  isActive
                    ? "bg-white/10 text-[#c4f06b]"
                    : "text-white/60 hover:bg-white/6 hover:text-white"
                }`
              }
            >
              <Icon size={19} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="mb-4 hidden h-px bg-white/10 sm:block" />
          <Button
            type="button"
            variant="ghost"
            aria-label="Log out"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            className="h-10 w-full justify-center gap-3 rounded-lg px-2 text-[11px] text-white/55 hover:bg-white/6 hover:text-white sm:justify-start sm:px-3"
          >
            {logoutMutation.isPending ? (
              <LoaderCircle size={19} className="animate-spin" />
            ) : (
              <LogOut size={19} />
            )}
            <span className="hidden sm:inline">
              {logoutMutation.isPending ? "Signing out…" : "Log out"}
            </span>
          </Button>

          {logoutError && (
            <p
              className="mt-2 wrap-break-word px-1 text-[10px] leading-4 text-[#f2a99a]"
              role="alert"
            >
              {logoutError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-3 border-t border-white/10 pt-4 sm:justify-start">
            {user.picture ? (
              <img
                src={user.picture}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#31453a] font-sans text-xs font-semibold text-[#d3efb1]">
                {initials}
              </span>
            )}
            <span className="hidden min-w-0 flex-1 sm:block">
              <span className="block truncate text-xs font-medium text-white/90">
                {displayName}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-white/40">
                {user.email ?? "Signed in"}
              </span>
            </span>
            <span className="hidden size-1.5 rounded-full bg-[#a9e85c] sm:block" />
          </div>
        </div>
      </aside>
      <NewAgentModal open={isNewAgentOpen} onOpenChange={setIsNewAgentOpen} />
    </>
  );
}
