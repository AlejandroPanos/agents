import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import AgentsPage from "./pages/agents";
import OverviewPage from "./pages/overview";
import { Sidebar } from "./components/navigation/sidebar";

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#f7f8f6] text-[#18231e]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
