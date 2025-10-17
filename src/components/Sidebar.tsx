import React, { useEffect, useState } from "react";
import {
  Home,
  ClipboardList,
  Calendar,
  Grid3x3,
  Clock,
  Settings,
  BarChart3,
  ArrowRightLeft,
  Truck,
  LogOut,
  User
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeItem: string;
  onItemChange: (item: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeItem, onItemChange }) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { id: "home", icon: Home, label: "Import Orders" },
    { id: "ibt", icon: ArrowRightLeft, label: "IBT Import" },
    { id: "ibt-dispatch", icon: Truck, label: "IBT Dispatch" },
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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4 space-y-6">
      {/* User Menu */}
      <div className="relative">
        <button
          className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-white hover:bg-gray-700 transition-colors"
          title={user?.username || "User"}
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <User className="w-5 h-5" />
        </button>

        {/* User Dropdown Menu */}
        {showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
            />
            <div className="absolute left-16 top-0 ml-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <p className="text-xs text-blue-600 mt-1 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </>
        )}
      </div>

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
