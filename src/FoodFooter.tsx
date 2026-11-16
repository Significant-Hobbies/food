import { createElement, useEffect } from "react";
import { FOOD_CAPTURE_LOADER, FOOD_FOOTER_CSS, FOOD_FOOTER_HTML, FOOD_FOOTER_ID, FOOD_FOOTER_RUNTIME, shouldRenderFoodCapture } from "../shared/capture-footer";

export default function FoodFooter() {
  const enabled = shouldRenderFoodCapture(new URL(window.location.href));
  useEffect(() => {
    if (!enabled || document.querySelector(`script[src="${FOOD_CAPTURE_LOADER}"]`)) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = FOOD_CAPTURE_LOADER;
    script.dataset.foodFooterRuntime = FOOD_FOOTER_RUNTIME;
    document.head.appendChild(script);
  }, [enabled]);
  if (!enabled) return null;
  return <>
    <style>{FOOD_FOOTER_CSS}</style>
    {createElement("studio-footer", { id: FOOD_FOOTER_ID, "data-mode": "light", "data-theme": "base", dangerouslySetInnerHTML: { __html: FOOD_FOOTER_HTML } })}
  </>;
}
