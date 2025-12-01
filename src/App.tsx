import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Settings, Smartphone } from "lucide-react";
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
            <Route path="/app-registry" element={
              <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
                <div className="text-center space-y-4 max-w-md">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Smartphone className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight">App Registry</h1>
                  <p className="text-muted-foreground text-lg">
                    We're working on something amazing. App Registry will be available soon!
                  </p>
                  <p className="text-sm text-muted-foreground pt-2">
                    Stay tuned for updates on managing your app builds and versions.
                  </p>
                </div>
              </div>
            } />
            <Route path="/integrations" element={
              <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
                <div className="text-center space-y-4 max-w-md">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Settings className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
                  <p className="text-muted-foreground text-lg">
                    We're working on something amazing. Integrations will be available soon!
                  </p>
                  <p className="text-sm text-muted-foreground pt-2">
                    Stay tuned for updates on connecting your favorite tools and services.
                  </p>
                </div>
              </div>
            } />
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
