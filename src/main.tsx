import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ReportApp from "./ReportApp";
import "./i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles/index.css";

// 右键菜单启动的报告窗口使用独立 label，避免加载完整主应用
const isReport = getCurrentWindow().label === "report";

ReactDOM.createRoot(document.getElementById("root")!).render(
  isReport ? (
    <ReportApp />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ),
);
