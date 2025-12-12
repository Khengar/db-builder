// src/utils/safeScreenshot.ts
import html2canvas from "html2canvas";
import chroma from "chroma-js";

/**
 * Take a safe screenshot: convert oklch(...) => hex everywhere in the cloned document
 * before html2canvas renders it.
 */
export async function safeScreenshot(
  element: HTMLElement,
  options: Partial<Parameters<typeof html2canvas>[1]> = {}
) {
  return html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    ...options,

    async onclone(doc: Document) {
      // 1) Convert computed CSS properties / inline styles / SVG attributes
      const all = Array.from(doc.querySelectorAll<HTMLElement>("*"));

      all.forEach((el) => {
        const style = getComputedStyle(el);

        const propsToFix = [
          "color",
          "background-color",
          "border-color",
          "outline-color",
          "fill",
          "stroke",
        ];

        // CSS properties from computed style
        propsToFix.forEach((prop) => {
          const val = style.getPropertyValue(prop);
          if (val && val.includes("oklch(")) {
            try {
              const hex = chroma(val).hex();
              el.style.setProperty(prop, hex, "important");
            } catch (e) {
              // ignore conversion errors
            }
          }
        });

        // Inline style attribute (style="...")
        const inline = el.getAttribute("style");
        if (inline && inline.includes("oklch(")) {
          const cleaned = inline.replace(/oklch\([^)]+\)/g, (match) => {
            try {
              return chroma(match).hex();
            } catch {
              return "#000";
            }
          });
          el.setAttribute("style", cleaned);
        }

        // SVG attributes
        const svgAttrs = ["fill", "stroke", "stop-color"];
        svgAttrs.forEach((attr) => {
          const val = el.getAttribute(attr);
          if (val && val.includes("oklch(")) {
            try {
              el.setAttribute(attr, chroma(val).hex());
            } catch {
              el.setAttribute(attr, "#000");
            }
          }
        });
      });

      // 2) Process stylesheets: gather rules that include oklch(...) and inject overrides
      // We will build a string of modified CSS rules and insert into a new <style> in the cloned doc.
      let overrideCss = "";

      for (const sheet of Array.from(doc.styleSheets)) {
        try {
          // Accessing cssRules may throw for cross-origin stylesheets; skip those
          const rules = (sheet as CSSStyleSheet).cssRules;
          if (!rules) continue;

          for (const rule of Array.from(rules as CSSRuleList)) {
            try {
              const text = (rule as CSSRule).cssText;
              if (text && text.includes("oklch(")) {
                // Replace each oklch(...) with hex using chroma
                const replaced = text.replace(/oklch\([^)]+\)/g, (match) => {
                  try {
                    return chroma(match).hex();
                  } catch {
                    return "#000";
                  }
                });
                // Collect the replaced rule text into override string
                overrideCss += replaced + "\n";
              }
            } catch (e) {
              // skip individual rule errors
            }
          }
        } catch (e) {
          // cross-origin stylesheet — cannot read rules; skip
          continue;
        }
      }

      if (overrideCss.length > 0) {
        const styleEl = doc.createElement("style");
        styleEl.setAttribute("data-generated", "oklch-to-hex");
        styleEl.textContent = overrideCss;
        // append to head so the rules override originals
        const head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;
        head.appendChild(styleEl);
      }

      // preserve any user-provided onclone
      if (options.onclone) {
        try {
          await options.onclone(doc);
        } catch (e) {
          // ignore user onclone errors
        }
      }
    },
  });
}
