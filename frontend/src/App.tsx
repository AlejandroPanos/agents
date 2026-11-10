import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { getApiErrorMessage, getCurrentUser, type UserProfile } from "./helpers/helpers";
import { Sidebar } from "./components/navigation/sidebar";
import AgentDetailPage from "./pages/agent-detail";
import AgentsPage from "./pages/agents";
import LoginPage from "./pages/login";
import OverviewPage from "./pages/overview";
import { queryKeys } from "./lib/query-keys";
import { Button } from "./components/ui/button";
import { LoaderCircle } from "lucide-react";

function DashboardLayout({ user }: { user: UserProfile }) {
  return (
    <div className="flex min-h-screen bg-[#f7f8f6] text-[#18231e]">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 px-5 pb-6 pt-16 sm:px-8 sm:pb-8 sm:pt-16 lg:px-12 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function SessionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0c0b] text-white">
      <p className="flex items-center gap-3 text-sm text-white/60" role="status">
        <LoaderCircle size={18} className="animate-spin" />
        Checking your session…
      </p>
    </main>
  );
}

function SessionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0c0b] px-4 text-white">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#171817] p-7 text-center">
        <h1 className="font-sans text-xl font-semibold">Unable to verify your session</h1>
        <p className="mt-3 text-xs leading-5 text-white/55">
          {getApiErrorMessage(error, "The backend could not verify your session.")}
        </p>
        <Button
          type="button"
          onClick={onRetry}
          className="mt-6 h-10 rounded-lg bg-[#1677e8] px-4 text-xs text-white hover:bg-[#318af0]"
        >
          Try again
        </Button>
      </section>
    </main>
  );
}

function AppRoutes() {
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async (): Promise<UserProfile | null> => {
      try {
        return await getCurrentUser();
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (currentUserQuery.isPending) {
    return <SessionLoading />;
  }

  if (currentUserQuery.isError && currentUserQuery.data === undefined) {
    return (
      <SessionError
        error={currentUserQuery.error}
        onRetry={() => {
          void currentUserQuery.refetch();
        }}
      />
    );
  }

  if (currentUserQuery.data === null) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<DashboardLayout user={currentUserQuery.data} />}>
        <Route index element={<OverviewPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:agentId" element={<AgentDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
