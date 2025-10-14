import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { DispatchView } from "./components/views/DispatchView";
import { OrderImport } from "./components/views/OrderImport";
import { CalendarView } from "./components/views/CalendarView";
import { AnalyticsView } from "./components/views/AnalyticsView";
import { AdvancedAnalytics } from "./components/views/AdvancedAnalytics";
import { HistoryView } from "./components/views/HistoryView";
import { Card } from "./components/ui/Card";
import { ConnectionStatus } from "./components/ConnectionStatus";

function App() {
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
        return (
          <Card className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Application configuration (Coming soon)</p>
          </Card>
        );
      default:
        return <DispatchView />;
    }
  };

  return (
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
  );
}

export default App;
