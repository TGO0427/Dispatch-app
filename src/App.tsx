import { useState, lazy, Suspense, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Sidebar } from "./components/Sidebar";
import { AlertHub } from "./components/AlertHub";
import { JobDetailsModal } from "./components/JobDetailsModal";
import { Login } from "./components/views/Login";
import { ForgotPassword } from "./components/views/ForgotPassword";
import { ResetPassword } from "./components/views/ResetPassword";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useDispatch } from "./context/DispatchContext";
import { Loader2 } from "lucide-react";

// Lazy-loaded views for code splitting
const Dashboard = lazy(() => import("./components/views/Dashboard").then(m => ({ default: m.Dashboard })));
const DispatchView = lazy(() => import("./components/views/DispatchView").then(m => ({ default: m.DispatchView })));
const IBTDispatchView = lazy(() => import("./components/views/IBTDispatchView").then(m => ({ default: m.IBTDispatchView })));
const OrderImport = lazy(() => import("./components/views/OrderImport").then(m => ({ default: m.OrderImport })));
const IBTImport = lazy(() => import("./components/views/IBTImport").then(m => ({ default: m.IBTImport })));
const CalendarView = lazy(() => import("./components/views/CalendarView").then(m => ({ default: m.CalendarView })));
const AnalyticsView = lazy(() => import("./components/views/AnalyticsView").then(m => ({ default: m.AnalyticsView })));
const AdvancedAnalytics = lazy(() => import("./components/views/AdvancedAnalytics").then(m => ({ default: m.AdvancedAnalytics })));
const HistoryView = lazy(() => import("./components/views/HistoryView").then(m => ({ default: m.HistoryView })));
const IBTReports = lazy(() => import("./components/views/IBTReports").then(m => ({ default: m.IBTReports })));
const UserManagement = lazy(() => import("./components/views/UserManagement").then(m => ({ default: m.UserManagement })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

type AuthView = "login" | "forgot-password" | "reset-password";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { jobs, drivers } = useDispatch();
  const [activeNavItem, setActiveNavItem] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [alertHubOpen, setAlertHubOpen] = useState(false);
  const [selectedJobFromAlert, setSelectedJobFromAlert] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Check URL for password reset token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset-token");
    if (token) {
      setResetToken(token);
      setAuthView("reset-password");
    }
  }, []);

  // Find job by ID for the modal triggered from AlertHub
  const alertJob = selectedJobFromAlert ? jobs.find(j => j.id === selectedJobFromAlert) : null;
  const alertJobDriver = alertJob?.driverId ? drivers.find(d => d.id === alertJob.driverId)?.name : undefined;

  const renderView = () => {
    let view;
    switch (activeNavItem) {
      case "dashboard":
        view = <Dashboard onOpenAlerts={() => setAlertHubOpen(true)} />; break;
      case "home":
        view = <OrderImport />; break;
      case "ibt":
        view = <IBTImport />; break;
      case "ibt-dispatch":
        view = <IBTDispatchView />; break;
      case "clipboard":
        view = <DispatchView onOpenAlerts={() => setAlertHubOpen(true)} />; break;
      case "calendar":
        view = <CalendarView />; break;
      case "grid":
        view = <AnalyticsView />; break;
      case "ibt-reports":
        view = <IBTReports />; break;
      case "analytics":
        view = <AdvancedAnalytics />; break;
      case "clock":
        view = <HistoryView />; break;
      case "settings":
      case "user-management":
        if (user?.role === "admin") {
          view = <UserManagement />; break;
        }
        setActiveNavItem("dashboard");
        view = <Dashboard />; break;
      default:
        view = <Dashboard />; break;
    }

    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {view}
        </Suspense>
      </ErrorBoundary>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === "reset-password" && resetToken) {
      return (
        <ResetPassword
          token={resetToken}
          onBack={() => {
            setResetToken(null);
            setAuthView("login");
          }}
        />
      );
    }
    if (authView === "forgot-password") {
      return <ForgotPassword onBack={() => setAuthView("login")} />;
    }
    return <Login onForgotPassword={() => setAuthView("forgot-password")} />;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <ConnectionStatus />

        <Sidebar
          activeItem={activeNavItem}
          onItemChange={setActiveNavItem}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <div className={`${sidebarCollapsed ? "ml-16" : "ml-60"} min-h-screen transition-all duration-300`}>
          <div className="mx-auto max-w-[1600px] p-8">
            {renderView()}
          </div>
        </div>

        {/* Alert Hub */}
        <AlertHub
          open={alertHubOpen}
          onClose={() => setAlertHubOpen(false)}
          onSelectJob={(jobId) => setSelectedJobFromAlert(jobId)}
        />

        {/* Job Details from Alert */}
        {alertJob && (
          <JobDetailsModal
            job={alertJob}
            onClose={() => setSelectedJobFromAlert(null)}
            driverName={alertJobDriver}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
