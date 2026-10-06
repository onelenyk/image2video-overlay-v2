export const SWATCHES = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff", "#0f172a"];

/** Opens the system file picker and returns the chosen file. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
