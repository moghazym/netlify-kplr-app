import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/app/AppLayout";
import { DashboardPage } from "./pages/app/DashboardPage";
import { TestSuitesPage } from "./pages/app/TestSuitesPage";
import { TestSuiteRunsPage } from "./pages/app/TestSuiteRunsPage";
import { TestRunsPage } from "./pages/app/TestRunsPage";
import { TestRunDetailPage } from "./pages/app/TestRunDetailPage";
import SchedulerPage from "./pages/app/SchedulerPage";
import PricingPage from "./pages/app/PricingPage";
import SecretsPage from "./pages/app/SecretsPage";
import CreateTestSuitePage from "./pages/app/CreateTestSuitePage";
import { AuthCallbackPage } from "./pages/app/AuthCallbackPage";
import AppRegistryPage from "./pages/app/AppRegistryPage";
import { Toaster } from "./components/ui/toaster";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <Router>
        <Routes>
          {/* Callback route should not be protected - it handles its own auth flow */}
          <Route path="/callback" element={<AuthCallbackPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/test-suites" element={<TestSuitesPage />} />
            <Route path="/create-suite" element={<CreateTestSuitePage />} />
            <Route path="/suite/:suiteId/runs" element={<TestSuiteRunsPage />} />
            <Route path="/test-runs" element={<TestRunsPage />} />
            <Route path="/test-runs/:runId" element={<TestRunDetailPage />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/secrets" element={<SecretsPage />} />
            <Route path="/app-registry" element={<AppRegistryPage />} />
            <Route path="/integrations" element={<div className="p-6">Integrations Page - Coming Soon</div>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </Router>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
