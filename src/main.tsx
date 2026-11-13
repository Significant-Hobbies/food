import { StrictMode, createElement } from "react";
import { ErrorState } from "@saas-maker/ui/molecules/error-state";
import { createRoot } from "react-dom/client";
import { isLocalOperatorRoute } from "./operator-route";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

async function mount() {
  const App = isLocalOperatorRoute(window.location)
    ? (await Promise.all([import("./App"), import("./styles.css")]))[0].App
    : (await Promise.all([import("./FoodApp"), import("./food.css")]))[0].FoodApp;
  createRoot(root!).render(<StrictMode><App /></StrictMode>);
}
void mount().catch(() => {
  createRoot(root!).render(createElement(ErrorState, { title: "Food couldn’t load.", onRetry: () => window.location.reload() }));
});
