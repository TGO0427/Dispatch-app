import React, { useEffect } from "react";
import {
  Home,
  ClipboardList,
  Calendar,
  Grid3x3,
  Clock,
  Settings,
  Menu,
  BarChart3
} from "lucide-react";

interface SidebarProps {
  activeItem: string;
  onItemChange: (item: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeItem, onItemChange }) => {
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "clipboard", icon: ClipboardList, label: "Jobs" },
    { id: "calendar", icon: Calendar, label: "Calendar" },
    { id: "grid", icon: Grid3x3, label: "Reports" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "clock", icon: Clock, label: "History" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  useEffect(() => {
    console.log("Sidebar: activeItem prop changed to:", activeItem);
  }, [activeItem]);

  const handleClick = (id: string) => {
    console.log("Sidebar: Button clicked:", id);
    console.log("Sidebar: Current activeItem prop:", activeItem);
    onItemChange(id);
  };

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4 space-y-6">
      {/* Menu Toggle */}
      <button
        className="text-white hover:text-blue-400 transition-colors"
        title="Menu"
        onClick={() => console.log("Menu button clicked")}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Navigation Icons */}
      <div className="flex-1 flex flex-col items-center space-y-4">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleClick(id)}
            className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
              activeItem === id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50 scale-110"
                : "text-gray-400 hover:text-white hover:bg-gray-800 hover:scale-105"
            }`}
            title={label}
            type="button"
          >
            <Icon className="w-5 h-5" />
            {activeItem === id && (
              <div className="absolute -right-1 top-0 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
