import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DispatchProvider } from "./context/DispatchContext";
import { mockDrivers } from "./data/mockData";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DispatchProvider initialJobs={[]} initialDrivers={mockDrivers}>
      <App />
    </DispatchProvider>
  </React.StrictMode>
);
