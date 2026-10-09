// Built-in markers, added to the canvas as tintable SVG images.
import { m, type Msg } from "../i18n";

const PATHS: Record<string, string> = {
  Down: "M11 5V14L7.5 10.5L6 12L12 18L18 12L16.5 10.5L13 14V5H11Z",
  Up: "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z",
  Right: "M5 13h12.5l-3.5 3.5 1.5 1.5 6-6-6-6-1.5 1.5 3.5 3.5H5v2z",
  Left: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  Double: "M21 12l-4-4v3H7V8l-4 4 4 4v-3h10v3l4-4z",
  Pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  Star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  Check: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  Cross: "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z",
  Warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  Info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  Home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  Flag: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
  Heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  Target: "M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z",
  Dot: "M12 4a8 8 0 100 16 8 8 0 000-16z",
};

// Names shown on the marker tiles
const LABELS: Record<string, Msg> = {
  Down: m("Down"), Up: m("Up"), Right: m("Right"), Left: m("Left"), Double: m("Double"), Pin: m("Pin"), Star: m("Star"),
  Check: m("Check"), Cross: m("Cross"), Warning: m("Warning"), Info: m("Info"), Home: m("Home"), Flag: m("Flag"),
  Heart: m("Heart"), Target: m("Target"), Dot: m("Dot"),
};

export const MARKERS = Object.entries(PATHS).map(([name, path]) => ({
  name,
  label: LABELS[name],
  path,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1024" height="1024"><path d="${path}"/></svg>`,
}));
