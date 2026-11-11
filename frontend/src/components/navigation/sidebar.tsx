import { useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  Bot,
  Command,
  House,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import NewAgentModal from "../../pages/new-agent";
import { getApiErrorMessage, logout, type UserProfile } from "../../helpers/helpers";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../ui/button";

const navigation = [
  { label: "Overview", to: "/", icon: House, end: true },
  { label: "Agents", to: "/agents", icon: Bot, end: false },
];

function SidebarTooltip({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled: boolean;
  children: ReactElement;
}) {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger delay={150} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="right" sideOffset={8} className="z-60 hidden lg:block">
          <Tooltip.Popup className="rounded-md border border-white/10 bg-[#263d30] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Sidebar({ user }: { user: UserProfile }) {
  const [isNewAgentOpen, setIsNewAgentOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
      {!isMobileOpen && (
        <SidebarTooltip label="Open navigation" disabled={false}>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="Open navigation"
            aria-expanded={isMobileOpen}
            aria-controls="app-sidebar"
            onClick={() => setIsMobileOpen(true)}
            className="fixed top-3 left-3 z-30 rounded-lg border border-[#dfe6df] bg-[#14251e] text-white shadow-sm hover:bg-[#263d30] hover:text-white lg:hidden"
          >
            <Menu size={19} />
          </Button>
        </SidebarTooltip>
      )}

      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh min-h-dvh max-h-dvh w-64 shrink-0 flex-col overflow-y-auto overscroll-contain bg-[#14251e] px-5 py-5 text-white shadow-xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-19 lg:px-3" : "lg:w-64 lg:px-5"}`}
      >
        <div
          className={`mb-6 flex items-center justify-between gap-2 ${
            isCollapsed ? "lg:flex-col lg:justify-start" : ""
          }`}
        >
          <SidebarTooltip label="Fieldwork home" disabled={!isCollapsed}>
            <Link
              to="/"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Agents home"
              className={`flex min-w-0 items-center gap-3 px-1 ${isCollapsed ? "lg:hidden" : ""}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#c4f06b] text-[#17271f]">
                <Command size={22} />
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-base font-semibold tracking-tight">
                  fieldwork
                </span>
                <span className="mt-0.5 block text-[10px] tracking-[0.18em] text-white/45 uppercase">
                  Agent workspace
                </span>
              </span>
            </Link>
          </SidebarTooltip>
          {isCollapsed && (
            <SidebarTooltip label="Fieldwork home" disabled={false}>
              <Link
                to="/"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Agents home"
                className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-[#c4f06b] text-[#17271f] lg:flex"
              >
                <Command size={22} />
              </Link>
            </SidebarTooltip>
          )}
          <SidebarTooltip label="Close navigation" disabled>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              onClick={() => setIsMobileOpen(false)}
              className="rounded-lg border border-white/10 bg-[#14251e] text-white shadow-sm hover:bg-[#263d30] hover:text-white lg:hidden"
            >
              <X size={18} />
            </Button>
          </SidebarTooltip>
          <SidebarTooltip
            label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            disabled={!isCollapsed}
          >
            <Button
              type="button"
              size="icon-lg"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              aria-controls="app-sidebar"
              onClick={() => setIsCollapsed((collapsed) => !collapsed)}
              className="hidden size-8 rounded-md border border-[#2b4338] bg-[#10251e] text-white/90 shadow-none hover:border-[#3a5849] hover:bg-[#193329] hover:text-white lg:flex"
            >
              {isCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
            </Button>
          </SidebarTooltip>
        </div>

        <SidebarTooltip label="Create new agent" disabled={!isCollapsed}>
          <Button
            type="button"
            aria-label="Create new agent"
            onClick={() => setIsNewAgentOpen(true)}
            className={`relative mb-7 h-10 w-full justify-start gap-2 rounded-lg bg-[#c4f06b] px-3 text-[11px] font-semibold text-[#17271f] hover:bg-[#d2f68a] ${isCollapsed ? "lg:justify-center lg:px-2" : ""}`}
          >
            <Plus size={16} />
            <span className={isCollapsed ? "lg:hidden" : ""}>Create new agent</span>
          </Button>
        </SidebarTooltip>

        <div
          className={`mb-3 px-2 text-[10px] font-medium tracking-[0.18em] text-white/40 uppercase ${isCollapsed ? "lg:hidden" : ""}`}
        >
          Workspace
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <SidebarTooltip key={to} label={label} disabled={!isCollapsed}>
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  `relative flex h-10 w-full items-center justify-start gap-3 rounded-lg px-3 text-[11px] transition-colors ${
                    isActive
                      ? "bg-white/10 text-[#c4f06b]"
                      : "text-white/60 hover:bg-white/6 hover:text-white"
                  } ${isCollapsed ? "lg:justify-center lg:px-2" : "lg:px-3"}`
                }
              >
                <Icon size={19} />
                <span className={isCollapsed ? "lg:hidden" : ""}>{label}</span>
              </NavLink>
            </SidebarTooltip>
          ))}
        </nav>

        <div className="mt-auto">
          <div className={`mb-4 h-px bg-white/10 ${isCollapsed ? "lg:hidden" : ""}`} />
          <SidebarTooltip
            label={logoutMutation.isPending ? "Signing out…" : "Log out"}
            disabled={!isCollapsed}
          >
            <Button
              type="button"
              variant="ghost"
              aria-label="Log out"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              className={`relative h-10 w-full justify-start gap-3 rounded-lg px-3 text-[11px] text-white/55 hover:bg-white/6 hover:text-white ${isCollapsed ? "lg:justify-center lg:px-2" : "lg:px-3"}`}
            >
              {logoutMutation.isPending ? (
                <LoaderCircle size={19} className="animate-spin" />
              ) : (
                <LogOut size={19} />
              )}
              <span className={isCollapsed ? "lg:hidden" : ""}>
                {logoutMutation.isPending ? "Signing out…" : "Log out"}
              </span>
            </Button>
          </SidebarTooltip>

          {logoutError && (!isCollapsed || isMobileOpen) && (
            <p
              className="mt-2 wrap-break-word px-1 text-[10px] leading-4 text-[#f2a99a]"
              role="alert"
            >
              {logoutError}
            </p>
          )}

          <div
            className={`mt-4 flex items-center justify-start gap-3 border-t border-white/10 pt-4 ${isCollapsed ? "lg:justify-center" : ""}`}
          >
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
            <span className={`min-w-0 flex-1 ${isCollapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-xs font-medium text-white/90">
                {displayName}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-white/40">
                {user.email ?? "Signed in"}
              </span>
            </span>
            <span
              className={`size-1.5 rounded-full bg-[#a9e85c] ${isCollapsed ? "lg:hidden" : ""}`}
            />
          </div>
        </div>
      </aside>
      <NewAgentModal open={isNewAgentOpen} onOpenChange={setIsNewAgentOpen} />
    </>
  );
}
