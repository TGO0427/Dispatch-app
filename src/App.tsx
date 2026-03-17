import { useState, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./components/views/Login";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
const UserManagement = lazy(() => import("./components/views/UserManagement").then(m => ({ default: m.UserManagement })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeNavItem, setActiveNavItem] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderView = () => {
    let view;
    switch (activeNavItem) {
      case "dashboard":
        view = <Dashboard />; break;
      case "home":
        view = <OrderImport />; break;
      case "ibt":
        view = <IBTImport />; break;
      case "ibt-dispatch":
        view = <IBTDispatchView />; break;
      case "clipboard":
        view = <DispatchView />; break;
      case "calendar":
        view = <CalendarView />; break;
      case "grid":
        view = <AnalyticsView />; break;
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
    return <Login />;
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

        <div className={`${sidebarCollapsed ? "ml-16" : "ml-60"} min-h-screen overflow-y-auto transition-all duration-300`}>
          <div className="mx-auto max-w-[1600px] p-8">
            {renderView()}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
