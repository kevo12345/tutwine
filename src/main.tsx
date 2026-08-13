import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupForcedUpdates } from "./lib/pwa-update";

createRoot(document.getElementById("root")!).render(<App />);

setupForcedUpdates();
