import { useState, lazy, Suspense, useEffect, useMemo } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Sidebar } from "./components/Sidebar";
import { AlertHub } from "./components/AlertHub";
import { JobDetailsModal } from "./components/JobDetailsModal";
import { Login } from "./components/views/Login";
import { PrivacyNotice } from "./components/views/PrivacyNotice";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { HelpGuide } from "./components/HelpGuide";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useDispatch } from "./context/DispatchContext";
import { Loader2, Mail } from "lucide-react";
import { messagesAPI } from "./services/api";

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
const FlowbinTracking = lazy(() => import("./components/views/FlowbinTracking").then(m => ({ default: m.FlowbinTracking })));
const InboxView = lazy(() => import("./components/views/InboxView").then(m => ({ default: m.InboxView })));
const UserManagement = lazy(() => import("./components/views/UserManagement").then(m => ({ default: m.UserManagement })));
const SettingsView = lazy(() => import("./components/views/SettingsView").then(m => ({ default: m.SettingsView })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

type AuthView = "login" | "privacy";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { jobs, drivers } = useDispatch();
  const [activeNavItem, setActiveNavItem] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [alertHubOpen, setAlertHubOpen] = useState(false);
  const [helpGuideOpen, setHelpGuideOpen] = useState(false);
  const [dispatchTab, setDispatchTab] = useState<string | undefined>(undefined);
  const [selectedJobFromAlert, setSelectedJobFromAlert] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>("login");

  // Unread message count
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchUnread = () => {
      messagesAPI.getUnreadCount().then((data) => setUnreadMessages(data.count)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Find job by ID for the modal triggered from AlertHub
  const alertJob = useMemo(() => selectedJobFromAlert ? jobs.find(j => j.id === selectedJobFromAlert) ?? null : null, [selectedJobFromAlert, jobs]);
  const alertJobDriver = useMemo(() => alertJob?.driverId ? drivers.find(d => d.id === alertJob.driverId)?.name : undefined, [alertJob, drivers]);

  const renderView = () => {
    let view;
    switch (activeNavItem) {
      case "dashboard":
        view = <Dashboard onOpenAlerts={() => setAlertHubOpen(true)} onNavigate={(page, tab) => { setActiveNavItem(page); setDispatchTab(tab); }} />; break;
      case "home":
        view = <OrderImport />; break;
      case "ibt":
        view = <IBTImport />; break;
      case "ibt-dispatch":
        view = <IBTDispatchView onOpenAlerts={() => setAlertHubOpen(true)} />; break;
      case "clipboard":
        view = <DispatchView onOpenAlerts={() => setAlertHubOpen(true)} initialTab={dispatchTab as any} />; break;
      case "calendar":
        view = <CalendarView />; break;
      case "grid":
        view = <AnalyticsView />; break;
      case "ibt-reports":
        view = <IBTReports />; break;
      case "flowbin-tracking":
        view = <FlowbinTracking />; break;
      case "analytics":
        view = <AdvancedAnalytics />; break;
      case "clock":
        view = <HistoryView />; break;
      case "inbox":
        view = <InboxView />; break;
      case "settings":
        view = <SettingsView />; break;
      case "user-management":
        if (user?.role === "admin") {
          view = <UserManagement />; break;
        }
        setActiveNavItem("dashboard");
        view = <Dashboard onNavigate={setActiveNavItem} />; break;
      default:
        view = <Dashboard onNavigate={setActiveNavItem} />; break;
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
    if (authView === "privacy") {
      return <PrivacyNotice onBack={() => setAuthView("login")} />;
    }
    return <Login onPrivacy={() => setAuthView("privacy")} />;
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
          onOpenHelp={() => setHelpGuideOpen(true)}
        />

        <div className={`${sidebarCollapsed ? "ml-16" : "ml-60"} min-h-screen transition-all duration-300`}>
          {/* Floating message notification */}
          {unreadMessages > 0 && activeNavItem !== "inbox" && (
            <button
              onClick={() => setActiveNavItem("inbox")}
              className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all animate-pulse hover:animate-none"
            >
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">{unreadMessages} new message{unreadMessages > 1 ? "s" : ""}</span>
            </button>
          )}
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

        {/* Help Guide */}
        <HelpGuide
          open={helpGuideOpen}
          onClose={() => setHelpGuideOpen(false)}
          onNavigateTo={(page) => setActiveNavItem(page)}
        />
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
