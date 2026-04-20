import React, { useState } from "react";
import { Settings, User as UserIcon, Lock, Bell, Palette, Shield, Save, Eye, EyeOff, Check, Volume2, VolumeX, Download } from "lucide-react";
import { privacyAPI } from "../../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useNotification } from "../../context/NotificationContext";
import { UserManagement } from "./UserManagement";

type SettingsTab = "profile" | "password" | "preferences" | "users";

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { showSuccess, showError } = useNotification();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Preferences state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("synercore_sound") !== "off";
  });

  const tabs: { key: SettingsTab; label: string; icon: React.FC<any>; adminOnly?: boolean }[] = [
    { key: "profile", label: "Profile", icon: UserIcon },
    { key: "password", label: "Change Password", icon: Lock },
    { key: "preferences", label: "Preferences", icon: Palette },
    { key: "users", label: "User Management", icon: Shield, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 12) {
      showError("New password must be at least 12 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/auth?action=change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        showError(data.message || "Failed to change password");
        return;
      }

      showSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showError("Failed to change password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("synercore_sound", newValue ? "on" : "off");
    showSuccess(`Notification sounds ${newValue ? "enabled" : "disabled"}`);
  };

  const passwordRequirements = [
    { label: "At least 12 characters", met: newPassword.length >= 12 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /\d/.test(newPassword) },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">Manage your account, preferences, and application settings</p>
          </div>
        </div>
      </Card>

      {/* Tabs + Content */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Tab Navigation */}
        <Card className="p-2 lg:col-span-1 h-fit">
          <nav className="space-y-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeTab === tab.key
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === tab.key ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Tab Content */}
        <div className="lg:col-span-3">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{user?.username || "User"}</h3>
                    <p className="text-sm text-gray-500">{user?.email || "No email"}</p>
                    <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
                      {user?.role || "user"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-900">
                      {user?.username}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-900">
                      {user?.email}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-900 capitalize">
                      {user?.role}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500 font-mono text-xs">
                      {user?.id}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  To update your username or email, contact your administrator.
                </p>

                {/* Data Export — POPIA s23 */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Your Data (POPIA s23)</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Download a copy of all personal data we hold about you.
                  </p>
                  <Button
                    variant="outline"
                    className="gap-2 text-sm"
                    onClick={async () => {
                      try {
                        await privacyAPI.exportMyData();
                        showSuccess("Data export downloaded");
                      } catch {
                        showError("Failed to export data");
                      }
                    }}
                  >
                    <Download className="w-4 h-4" /> Export My Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Change Password Tab */}
          {activeTab === "password" && (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPwd ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Enter your current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Enter new password (min 12 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {newPassword.length > 0 && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    {passwordRequirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check className={`w-3.5 h-3.5 ${req.met ? "text-green-500" : "text-gray-300"}`} />
                        <span className={req.met ? "text-green-700" : "text-gray-500"}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Confirm new password"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button
                  onClick={handlePasswordChange}
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="gap-2"
                >
                  {isChangingPassword ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Changing...
                    </span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              {/* Theme */}
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Palette className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Theme</p>
                        <p className="text-xs text-gray-500">Choose between light and dark mode</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        theme === "dark" ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                          theme === "dark" ? "translate-x-7" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 px-1">
                    Currently: {theme === "dark" ? "Dark Mode" : "Light Mode"}
                  </p>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-3">
                      {soundEnabled ? (
                        <Volume2 className="w-5 h-5 text-gray-500" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-gray-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">Notification Sounds</p>
                        <p className="text-xs text-gray-500">Play audio cues when notifications appear</p>
                      </div>
                    </div>
                    <button
                      onClick={handleSoundToggle}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        soundEnabled ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                          soundEnabled ? "translate-x-7" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 px-1">
                    Sounds: Success (rising chord), Error (descending tone), Warning (alert beep), Info (gentle two-tone)
                  </p>
                </CardContent>
              </Card>

              {/* Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Data & Sync</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Auto-refresh</p>
                        <p className="text-xs text-gray-500">Data syncs with the server every 15 seconds</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Active</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* User Management Tab (Admin only) */}
          {activeTab === "users" && isAdmin && (
            <UserManagement />
          )}
        </div>
      </div>
    </div>
  );
};
