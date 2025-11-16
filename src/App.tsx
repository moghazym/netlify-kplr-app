import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/app/AppLayout";
import { DashboardPage } from "./pages/app/DashboardPage";
import { TestSuitesPage } from "./pages/app/TestSuitesPage";
import { TestSuiteRunsPage } from "./pages/app/TestSuiteRunsPage";
import { TestRunsPage } from "./pages/app/TestRunsPage";
import SchedulerPage from "./pages/app/SchedulerPage";
import PricingPage from "./pages/app/PricingPage";
import { Toaster } from "./components/ui/toaster";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Router>
        <ProtectedRoute>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/test-suites" element={<TestSuitesPage />} />
              <Route path="/suite/:suiteId/runs" element={<TestSuiteRunsPage />} />
              <Route path="/test-runs" element={<TestRunsPage />} />
              <Route path="/scheduler" element={<SchedulerPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/secrets" element={<div className="p-6">Secrets & Variables Page - Coming Soon</div>} />
              <Route path="/integrations" element={<div className="p-6">Integrations Page - Coming Soon</div>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ProtectedRoute>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
