import React, { useState } from "react";
import {
  LayoutDashboard,
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
  User,
  ChevronLeft,
  ChevronRight,
  Bell,
  Users,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeItem: string;
  onItemChange: (item: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  icon: React.FC<any>;
  label: string;
  adminOnly?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeItem, onItemChange, collapsed, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const navSections: NavSection[] = [
    {
      title: "",
      items: [
        { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
      ],
    },
    {
      title: "DISPATCH",
      items: [
        { id: "home", icon: Home, label: "Import Orders" },
        { id: "ibt", icon: ArrowRightLeft, label: "IBT Import" },
        { id: "ibt-dispatch", icon: Truck, label: "IBT Dispatch" },
        { id: "clipboard", icon: ClipboardList, label: "Jobs" },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        { id: "calendar", icon: Calendar, label: "Calendar" },
        { id: "grid", icon: Grid3x3, label: "Reports" },
        { id: "analytics", icon: BarChart3, label: "Analytics" },
        { id: "clock", icon: Clock, label: "History" },
      ],
    },
  ];

  const bottomItems: NavItem[] = [
    { id: "settings", icon: Settings, label: "Settings", adminOnly: true },
    { id: "notifications", icon: Bell, label: "Notifications" },
    { id: "user-management", icon: Users, label: "User Management", adminOnly: true },
  ];

  const filteredBottomItems = bottomItems.filter(item => {
    if (item.adminOnly) return user?.role === "admin";
    return true;
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Filter nav items based on search
  const filterItems = (items: NavItem[]) => {
    if (!searchQuery) return items;
    return items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-gray-900 flex flex-col z-30 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        {!collapsed && (
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Dispatch</h1>
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">
              Dispatch & Receiving
            </p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-md bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 text-gray-300 text-sm rounded-md pl-8 pr-3 py-2 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
            />
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4 scrollbar-thin">
        {navSections.map((section, sectionIdx) => {
          const items = filterItems(
            section.items.filter(item => {
              if ((item as any).adminOnly) return user?.role === "admin";
              return true;
            })
          );
          if (items.length === 0) return null;

          return (
            <div key={sectionIdx}>
              {section.title && !collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </p>
              )}
              {collapsed && section.title && (
                <div className="border-t border-gray-800 mx-2 my-2" />
              )}
              <div className="space-y-0.5">
                {items.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => onItemChange(id)}
                    className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 ${
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                    } ${
                      activeItem === id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-gray-800">
          <p className="px-1 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Quick Stats
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-gray-400">Total Items</span>
              <span className="text-sm font-semibold text-white">--</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-green-400">In Transit</span>
              <span className="text-sm font-semibold text-white">--</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-red-400">Delayed</span>
              <span className="text-sm font-bold text-red-400">--</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="border-t border-gray-800 px-2 py-2 space-y-0.5">
        {filteredBottomItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onItemChange(id)}
            className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 ${
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
            } ${
              activeItem === id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{label}</span>}
          </button>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 text-gray-400 hover:text-red-400 hover:bg-gray-800 ${
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          }`}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username || "User"}</p>
            <p className="text-xs text-gray-500 truncate">{user?.role || "user"}</p>
          </div>
        </div>
      )}
    </div>
  );
};
