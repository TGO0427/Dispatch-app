import React, { useState, useMemo } from "react";
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
  ChevronDown,
  Bell,
  Users,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDispatch } from "../context/DispatchContext";

interface SidebarProps {
  activeItem: string;
  onItemChange: (item: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenAlerts?: () => void;
}

interface NavItem {
  id: string;
  icon: React.FC<any>;
  label: string;
  adminOnly?: boolean;
  badge?: number;
  badgeType?: "danger" | "info";
}

interface NavSection {
  key: string;
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeItem, onItemChange, collapsed, onToggleCollapse, onOpenAlerts }) => {
  const { user, logout } = useAuth();
  const { jobs } = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dispatch: true,
    operations: true,
  });

  // Compute live stats
  const orderJobs = jobs.filter((j) => j.jobType === "order" || j.jobType === undefined);
  const totalJobs = orderJobs.length;
  const inTransit = orderJobs.filter((j) => j.status === "en-route").length;
  const exceptions = orderJobs.filter((j) => j.status === "exception").length;
  const pendingCount = orderJobs.filter((j) => j.status === "pending").length;

  const navSections: NavSection[] = [
    {
      key: "dispatch",
      title: "DISPATCH",
      items: [
        { id: "home", icon: Home, label: "Import Customer Orders" },
        { id: "ibt", icon: ArrowRightLeft, label: "IBT Import" },
        { id: "ibt-dispatch", icon: Truck, label: "IBT Dispatch" },
        { id: "clipboard", icon: ClipboardList, label: "Order Management", badge: pendingCount, badgeType: "info" },
      ],
    },
    {
      key: "operations",
      title: "OPERATIONS",
      items: [
        { id: "calendar", icon: Calendar, label: "Scheduling" },
        { id: "grid", icon: Grid3x3, label: "Order Reports" },
        { id: "ibt-reports", icon: ArrowRightLeft, label: "IBT Reports" },
        { id: "analytics", icon: BarChart3, label: "Analytics" },
        { id: "clock", icon: Clock, label: "Order History" },
      ],
    },
  ];

  // Count active alerts (overdue, exceptions, ETD today/tomorrow, unassigned priority)
  const alertCount = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let count = 0;
    const seen = new Set<string>();
    orderJobs.forEach((j) => {
      if (seen.has(j.ref)) return;
      seen.add(j.ref);
      if (j.status === "exception") count++;
      if (j.eta && j.status !== "delivered" && j.status !== "cancelled") {
        const eta = new Date(j.eta); eta.setHours(0, 0, 0, 0);
        if (eta < now) count++; // overdue
      }
      if (j.etd && j.status !== "delivered" && j.status !== "cancelled" && j.status !== "en-route") {
        const etd = new Date(j.etd); etd.setHours(0, 0, 0, 0);
        const diff = Math.floor((etd.getTime() - now.getTime()) / 86400000);
        if (diff <= 1) count++; // ETD today or tomorrow
      }
    });
    return count;
  }, [orderJobs]);

  const bottomItems: NavItem[] = [
    { id: "settings", icon: Settings, label: "Settings", adminOnly: true },
    { id: "user-management", icon: Users, label: "User Management", adminOnly: true },
  ];

  const filteredBottomItems = bottomItems.filter(item => {
    if (item.adminOnly) return user?.role === "admin";
    return true;
  });

  const handleLogout = async () => {
    try { await logout(); } catch (error) { console.error("Logout error:", error); }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const matchesSearch = (label: string) => {
    if (!searchQuery) return true;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const filterItems = (items: NavItem[]) => {
    return items.filter(item => {
      if (item.adminOnly && user?.role !== "admin") return false;
      return matchesSearch(item.label);
    });
  };

  const renderNavButton = ({ id, icon: Icon, label, badge, badgeType }: NavItem) => (
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
        <>
          <span className="text-sm font-medium truncate flex-1 text-left">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              badgeType === "danger" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
            }`}>
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );

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

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {/* Dashboard - always visible */}
        {matchesSearch("Dashboard") && renderNavButton({
          id: "dashboard", icon: LayoutDashboard, label: "Dashboard",
        })}

        {/* Collapsible Sections */}
        {navSections.map((section) => {
          const items = filterItems(section.items);
          if (items.length === 0) return null;

          const isExpanded = searchQuery ? true : expandedSections[section.key] !== false;

          return (
            <div key={section.key} className="mt-3">
              {!collapsed ? (
                <button
                  onClick={() => !searchQuery && toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-3 mb-1.5 group"
                >
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${
                      isExpanded ? "" : "-rotate-90"
                    }`}
                  />
                </button>
              ) : (
                <div className="border-t border-gray-800 mx-2 my-2" />
              )}

              <div
                className={`space-y-0.5 overflow-hidden transition-all duration-200 ${
                  isExpanded ? "max-h-96 opacity-100" : collapsed ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {items.map(renderNavButton)}
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
              <span className="text-sm text-gray-400">Total Jobs</span>
              <span className="text-sm font-semibold text-white">{totalJobs}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-green-400">In Transit</span>
              <span className="text-sm font-semibold text-white">{inTransit}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-red-400">Exceptions</span>
              <span className={`text-sm font-bold ${exceptions > 0 ? "text-red-400" : "text-white"}`}>
                {exceptions}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="border-t border-gray-800 px-2 py-2 space-y-0.5">
        {/* Alerts Button */}
        <button
          onClick={onOpenAlerts}
          className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 text-gray-400 hover:text-white hover:bg-gray-800 ${
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          }`}
          title={collapsed ? "Alerts" : undefined}
        >
          <div className="relative flex-shrink-0">
            <Bell className="w-[18px] h-[18px]" />
            {alertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <span className="text-sm font-medium flex-1 text-left">Alerts</span>
              {alertCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  {alertCount}
                </span>
              )}
            </>
          )}
        </button>

        {filteredBottomItems.map(renderNavButton)}

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
