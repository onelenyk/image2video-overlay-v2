import { useState, type DragEvent } from "react";

/** Lets a whole screen accept a dropped image file. Spread `handlers` on the screen's root element. */
export function useImageDrop(onImage: (file: File) => void) {
  const [dropping, setDropping] = useState(false);
  const handlers = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDropping(true); },
    onDragLeave: () => setDropping(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDropping(false);
      const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
      if (file) onImage(file);
    },
  };
  return { dropping, handlers };
}
