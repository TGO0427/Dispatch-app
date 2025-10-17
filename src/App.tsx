import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar } from "./components/Sidebar";
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
import { Loader2 } from "lucide-react";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeNavItem, setActiveNavItem] = useState<string>("home");

  const handleNavChange = (item: string) => {
    console.log("App: Changing nav to:", item);
    setActiveNavItem(item);
  };

  useEffect(() => {
    console.log("App: activeNavItem state updated to:", activeNavItem);
  }, [activeNavItem]);

  const renderView = () => {
    switch (activeNavItem) {
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
        return <UserManagement />;
      default:
        return <DispatchView />;
    }
  };

  // Show loading state while checking authentication
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

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show main app if authenticated
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Connection Status Overlay */}
        <ConnectionStatus />

        {/* Sidebar Navigation */}
        <Sidebar activeItem={activeNavItem} onItemChange={handleNavChange} />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
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
