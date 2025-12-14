import { toPng } from "html-to-image";

/**
 * Export the diagram as cropped 2× high-resolution PNG.
 * Detects real table sizes — nothing is ever cut.
 */
export async function exportDiagramPNG() {
  const tables = Array.from(document.querySelectorAll(".table-node")) as HTMLElement[];
  const canvas = document.querySelector("#diagram-root") as HTMLElement;
  if (!canvas || tables.length === 0) {
    alert("Nothing to export.");
    return;
  }

  // --------------------------------------------------------
  // 1. Measure real bounding boxes of all tables
  // --------------------------------------------------------
  const tableRects = tables.map(t => {
    const rect = t.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    };
  });

  // Convert screen coords → canvas coords (reverse viewport transform)
  const viewport = (window as any).useDBStore?.getState()?.viewport 
                || { x: 0, y: 0, scale: 1 };

  function screenToCanvas(px: number, py: number) {
    return {
      x: (px - viewport.x) / viewport.scale,
      y: (py - viewport.y) / viewport.scale
    };
  }

  const canvasRects = tableRects.map(r => {
    const topLeft = screenToCanvas(r.x, r.y);
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: r.w / viewport.scale,
      h: r.h / viewport.scale
    };
  });

  // --------------------------------------------------------
  // 2. Compute true diagram bounding box
  // --------------------------------------------------------
  const minX = Math.min(...canvasRects.map(r => r.x));
  const minY = Math.min(...canvasRects.map(r => r.y));
  const maxX = Math.max(...canvasRects.map(r => r.x + r.w));
  const maxY = Math.max(...canvasRects.map(r => r.y + r.h));

  // Padding to avoid tight cropping
  const PADDING = 80;

  const cropWidth = maxX - minX + PADDING * 2;
  const cropHeight = maxY - minY + PADDING * 2;

  // --------------------------------------------------------
  // 3. Build wrapper for clipped export
  // --------------------------------------------------------
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.left = "0";
  wrapper.style.top = "0";
  wrapper.style.background = "white";
  wrapper.style.width = `${cropWidth}px`;
  wrapper.style.height = `${cropHeight}px`;
  wrapper.style.overflow = "hidden";

  // Clone canvas
  const clone = canvas.cloneNode(true) as HTMLElement;

  clone.style.transformOrigin = "0 0";
  clone.style.transform =
    `translate(${-minX + PADDING}px, ${-minY + PADDING}px) scale(${viewport.scale})`;

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  // --------------------------------------------------------
  // 4. Export high-res PNG (2×)
  // --------------------------------------------------------
  try {
    const png = await toPng(wrapper, {
      width: cropWidth * 2,
      height: cropHeight * 2,
      style: {
        transform: "scale(2)",
        transformOrigin: "top left",
      },
    });

    const link = document.createElement("a");
    link.download = "diagram.png";
    link.href = png;
    link.click();
  } catch (err) {
    console.error(err);
    alert("Failed to export PNG.");
  }

  wrapper.remove();
}
