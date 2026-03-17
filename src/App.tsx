import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/views/Dashboard";
import { DispatchView } from "./components/views/DispatchView";
import { IBTDispatchView } from "./components/views/IBTDispatchView";
import { OrderImport } from "./components/views/OrderImport";
import { IBTImport } from "./components/views/IBTImport";
import { CalendarView } from "./components/views/CalendarView";
import { AnalyticsView } from "./components/views/AnalyticsView";
import { AdvancedAnalytics } from "./components/views/AdvancedAnalytics";
import { HistoryView } from "./components/views/HistoryView";
import { Login } from "./components/views/Login";
import { UserManagement } from "./components/views/UserManagement";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Loader2, Save, Check } from "lucide-react";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Initialize from localStorage or default to "dashboard"
  const [activeNavItem, setActiveNavItem] = useState<string>(() => {
    const saved = localStorage.getItem("activeNavItem");
    return saved || "dashboard";
  });

  const [savedView, setSavedView] = useState<string | null>(() => {
    return localStorage.getItem("activeNavItem");
  });

  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavChange = (item: string) => {
    setActiveNavItem(item);
  };

  const handleSaveView = () => {
    localStorage.setItem("activeNavItem", activeNavItem);
    setSavedView(activeNavItem);

    setShowSaveConfirmation(true);
    setTimeout(() => {
      setShowSaveConfirmation(false);
    }, 2000);
  };

  const renderView = () => {
    switch (activeNavItem) {
      case "dashboard":
        return <Dashboard />;
      case "home":
        return <OrderImport />;
      case "ibt":
        return <IBTImport />;
      case "ibt-dispatch":
        return <IBTDispatchView />;
      case "clipboard":
        return <DispatchView />;
      case "calendar":
        return <CalendarView />;
      case "grid":
        return <AnalyticsView />;
      case "analytics":
        return <AdvancedAnalytics />;
      case "clock":
        return <HistoryView />;
      case "settings":
        if (user?.role === "admin") {
          return <UserManagement />;
        }
        setActiveNavItem("dashboard");
        return <Dashboard />;
      case "user-management":
        if (user?.role === "admin") {
          return <UserManagement />;
        }
        setActiveNavItem("dashboard");
        return <Dashboard />;
      default:
        return <Dashboard />;
    }
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
          onItemChange={handleNavChange}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Area - responsive to sidebar width */}
        <div className={`${sidebarCollapsed ? "ml-16" : "ml-60"} min-h-screen overflow-y-auto transition-all duration-300`}>
          <div className="mx-auto max-w-[1600px] p-8">
            {/* Save View Button */}
            <div className="fixed bottom-8 right-8 z-40">
              {savedView !== activeNavItem && (
                <button
                  onClick={handleSaveView}
                  className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
                  title="Save this view as your default"
                >
                  <Save className="h-5 w-5" />
                  <span className="font-medium">Save as Default View</span>
                </button>
              )}

              {showSaveConfirmation && (
                <div className="absolute bottom-16 right-0 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-fade-in">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">View saved!</span>
                </div>
              )}
            </div>

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
