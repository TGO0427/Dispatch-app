import React, { useState } from "react";
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface ResetPasswordProps {
  token: string;
  onBack: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export const ResetPassword: React.FC<ResetPasswordProps> = ({ token, onBack }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
  ];

  const allRequirementsMet = requirements.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Password is required");
      return;
    }

    if (!allRequirementsMet) {
      setError("Password does not meet all requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to reset password. Please try again.");
        return;
      }

      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => {
        // Clear the reset token from URL
        window.history.replaceState({}, "", window.location.pathname);
        onBack();
      }, 3000);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Password</h1>
          <p className="text-gray-600">
            {success ? "Your password has been reset!" : "Create a new password for your account"}
          </p>
        </div>

        <Card className="p-8 shadow-xl">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              {/* New Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter new password"
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              {password.length > 0 && (
                <div className="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Password requirements:</p>
                  {requirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${req.met ? "text-green-500" : "text-gray-400"}`}>
                        {req.met ? <CheckCircle className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full border border-gray-400" />}
                      </div>
                      <span className={`text-xs ${req.met ? "text-green-700" : "text-gray-500"}`}>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Confirm new password"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full py-3 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Password Reset!</h2>
              <p className="text-sm text-gray-600">
                Your password has been updated. Redirecting to login...
              </p>
            </div>
          )}
        </Card>

        {/* Back to Login */}
        {!success && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                window.history.replaceState({}, "", window.location.pathname);
                onBack();
              }}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
