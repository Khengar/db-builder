// utils/safeScreenshot.ts
import { toCanvas } from "html-to-image";

export async function safeScreenshot(
  element: HTMLElement,
  options?: any // html-to-image options
): Promise<HTMLCanvasElement> {
  // html-to-image handles modern CSS (oklch) natively because it uses 
  // SVG foreignObject to let the browser render the content.
  
  return await toCanvas(element, {
    backgroundColor: "#ffffff", // Ensure white background for the screenshot
    pixelRatio: 1, // Avoids huge images on Retina displays unless needed
    skipAutoScale: true, // Prevents internal scaling weirdness
    ...options,
  });
}