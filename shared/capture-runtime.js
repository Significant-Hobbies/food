export function activateFoodCapture(root) {
  root.dataset.captureReady = "true";
  for (const button of root.querySelectorAll("button[type=submit], button[data-feedback-open]")) button.disabled = false;
  root.querySelector("[data-food-capture-status]").textContent = "";
}

const root = document.getElementById("food-capture-footer");
const script = document.querySelector("script[data-food-footer-runtime]");
if (root && script) {
  const unavailable = () => {
    root.querySelector("[data-food-capture-status]").textContent = "Updates and feedback couldn’t load. Reload to try again.";
  };
  try {
    const runtime = new URL(script.dataset.foodFooterRuntime, location.href);
    if (runtime.origin !== location.origin || !/^\/assets\/footer-[A-Za-z0-9_-]+\.js$/.test(runtime.pathname)) throw new Error("Invalid footer asset");
    import(runtime.href).then(() => activateFoodCapture(root)).catch(unavailable);
  } catch { unavailable(); }
}
