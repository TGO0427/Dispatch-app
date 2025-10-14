// src/components/ConnectionStatus.tsx
import React, { useEffect, useState } from "react";
import { healthCheck } from "../services/api";
import { useDispatch } from "../context/DispatchContext";

export const ConnectionStatus: React.FC = () => {
  const { error, isLoading, refreshData, clearError } = useDispatch();
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  useEffect(() => {
    checkAPIConnection();
    const interval = setInterval(checkAPIConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkAPIConnection = async () => {
    try {
      await healthCheck();
      setApiStatus("connected");
    } catch (error) {
      setApiStatus("disconnected");
      console.error("API health check failed:", error);
    }
  };

  const handleRetry = () => {
    clearError();
    refreshData();
  };

  // Error banner
  if (error) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-3 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={handleRetry}
            className="px-3 py-1 bg-white text-red-600 rounded hover:bg-red-50 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading indicator
  if (isLoading) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white px-4 py-2 shadow-lg">
        <div className="container mx-auto flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Syncing with server...</span>
        </div>
      </div>
    );
  }

  // Connection status indicator (bottom right corner)
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-xs font-medium ${
          apiStatus === "connected"
            ? "bg-green-100 text-green-800"
            : apiStatus === "disconnected"
            ? "bg-red-100 text-red-800"
            : "bg-yellow-100 text-yellow-800"
        }`}
      >
        <div
          className={`h-2 w-2 rounded-full ${
            apiStatus === "connected"
              ? "bg-green-500 animate-pulse"
              : apiStatus === "disconnected"
              ? "bg-red-500"
              : "bg-yellow-500 animate-pulse"
          }`}
        />
        <span>
          {apiStatus === "connected"
            ? "Connected"
            : apiStatus === "disconnected"
            ? "Offline Mode"
            : "Checking..."}
        </span>
        {apiStatus === "disconnected" && (
          <button
            onClick={handleRetry}
            className="ml-2 text-red-600 hover:text-red-700 underline"
          >
            Reconnect
          </button>
        )}
      </div>
      {apiStatus === "disconnected" && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          Using local data
        </div>
      )}
    </div>
  );
};
