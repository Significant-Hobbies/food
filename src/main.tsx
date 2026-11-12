import { StrictMode } from "react";
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
  root.textContent = "Food couldn’t load. ";
  const retry = document.createElement("button");
  retry.textContent = "Reload Food";
  retry.onclick = () => window.location.reload();
  root.append(retry);
});
