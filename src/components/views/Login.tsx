import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Truck, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface LoginProps {
  onForgotPassword?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onForgotPassword }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(to bottom right, #eff6ff, #ffffff, #eff6ff)" }}>
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#0f172a" }}>Dispatch Management</h1>
          <p style={{ color: "#4b5563" }}>Sign in to your account to continue</p>
        </div>

        {/* Login Card */}
        <Card className="p-8 shadow-xl" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                style={{ background: "#ffffff", border: "1px solid #d1d5db", color: "#0f172a" }}
                placeholder="Enter your username"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ background: "#ffffff", border: "1px solid #d1d5db", color: "#0f172a" }}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm" style={{ color: "#4b5563" }}>Remember me</span>
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full py-3 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm" style={{ color: "#4b5563" }}>
          <p>
            Need an account?{" "}
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              Contact your administrator
            </button>
          </p>
        </div>

        {/* Demo Credentials Info */}
        <div className="mt-8 p-4 rounded-lg" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
          <p className="text-sm font-medium mb-2" style={{ color: "#1e3a5f" }}>Demo Credentials:</p>
          <p className="text-xs" style={{ color: "#1e40af" }}>Username: <span className="font-mono">admin</span></p>
          <p className="text-xs" style={{ color: "#1e40af" }}>Password: <span className="font-mono">admin123</span></p>
        </div>
      </div>
    </div>
  );
};
