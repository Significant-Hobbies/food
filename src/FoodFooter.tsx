import { createElement, useEffect } from "react";
import { Button } from "@saas-maker/ui/atoms/button";
import { FOOD_FOOTER_CSS, FOOD_FOOTER_HTML, FOOD_FOOTER_ID, FOOD_FOOTER_RUNTIME, shouldRenderFoodCapture } from "../shared/capture-footer";

export default function FoodFooter() {
  const enabled = shouldRenderFoodCapture(new URL(window.location.href));
  useEffect(() => {
    if (!enabled || document.querySelector(`script[src="${FOOD_FOOTER_RUNTIME}"]`)) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = FOOD_FOOTER_RUNTIME;
    document.head.appendChild(script);
  }, [enabled]);
  if (!enabled) return <footer className="food-footer"><span>Food by Significant Hobbies</span><span><Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://world.openfoodfacts.org">Open Food Facts</a></Button> · <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></Button> · <Button asChild variant="link" className="h-auto whitespace-normal text-left"><a href="https://github.com/Significant-Hobbies/food">Source code</a></Button></span></footer>;
  return <>
    <style>{FOOD_FOOTER_CSS}</style>
    {createElement("studio-footer", { id: FOOD_FOOTER_ID, dangerouslySetInnerHTML: { __html: FOOD_FOOTER_HTML } })}
  </>;
}
