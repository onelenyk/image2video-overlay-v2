import { parseTemplate, type TemplateSpec } from "../engine/template";
import { localizeTemplate } from "../i18n/templates";

// The bundled templates. They are plain data in the same format a template
// from anywhere else would use, and they go through the same validation.
// Coordinates are fractions of the stage; colours and sizes are style tokens.
// Each one is laid out over its sample picture (see templateSamples.ts), and all
// text sits on a plate so it reads on any photo.
const RAW: unknown[] = [
  // ---------- Property: floor plans and listings ----------
  { v: 1, id: "room-tour", name: "Room tour", group: "Property", sample: "plan", hint: "Rooms light up one after another, each with its name", parts: [
    { kind: "zone", x: 0.071, y: 0.071, w: 0.464, h: 0.476, tone: "accent", border: "none", at: 0, name: "Living room zone", set: "Living room" },
    { kind: "pill", text: "Living room", x: 0.304, y: 0.31, size: "sm", at: 0.2, set: "Living room" },
    { kind: "zone", x: 0.536, y: 0.071, w: 0.393, h: 0.381, tone: "info", border: "none", at: 1.2, name: "Kitchen zone", set: "Kitchen" },
    { kind: "pill", text: "Kitchen", x: 0.732, y: 0.262, size: "sm", at: 1.4, set: "Kitchen" },
    { kind: "zone", x: 0.071, y: 0.548, w: 0.393, h: 0.381, tone: "success", border: "none", at: 2.4, name: "Bedroom zone", set: "Bedroom" },
    { kind: "pill", text: "Bedroom", x: 0.268, y: 0.738, size: "sm", at: 2.6, set: "Bedroom" },
    { kind: "zone", x: 0.714, y: 0.619, w: 0.214, h: 0.31, tone: "danger", border: "none", at: 3.6, name: "Bath zone", set: "Bath" },
    { kind: "pill", text: "Bath", x: 0.821, y: 0.774, size: "sm", at: 3.8, set: "Bath" },
  ] },
  { v: 1, id: "areas", name: "Room sizes", group: "Property", sample: "plan", hint: "Square metres in each room and the total", parts: [
    { kind: "pill", text: "19 m²", x: 0.304, y: 0.31, size: "sm", at: 0 },
    { kind: "pill", text: "12 m²", x: 0.732, y: 0.262, size: "sm", at: 0.5 },
    { kind: "pill", text: "11 m²", x: 0.268, y: 0.738, size: "sm", at: 1 },
    { kind: "pill", text: "5 m²", x: 0.821, y: 0.774, size: "sm", at: 1.5 },
    { kind: "pill", text: "47 m² total", x: 0.7, y: 0.536, tone: "accent", at: 2.2, anim: { type: "pop", seconds: 3 } },
  ] },
  { v: 1, id: "walk-through", name: "Walk-through", group: "Property", sample: "plan", hint: "A route from the front door through the rooms", parts: [
    { kind: "point", x: 0.589, y: 0.9, tone: "success", at: 0, anim: { type: "ripple", seconds: 2 }, name: "Front door" },
    { kind: "route", points: [[0.589, 0.9], [0.589, 0.64], [0.56, 0.5], [0.45, 0.48], [0.32, 0.44]], tone: "info", at: 0.5, seconds: 2.4, name: "Route" },
    { kind: "symbol", symbol: "pin", x: 0.32, y: 0.35, tone: "danger", size: 0.11, at: 2.9, anim: { type: "bounce", seconds: 1 }, set: "Living room" },
    { kind: "pill", text: "Living room", x: 0.3, y: 0.14, size: "sm", at: 3.1, set: "Living room" },
  ] },
  { v: 1, id: "furniture", name: "Furniture", group: "Property", sample: "plan", hint: "Plan symbols that appear one by one", parts: [
    { kind: "symbol", symbol: "sofa", x: 0.27, y: 0.4, tone: "dark", size: 0.17, at: 0.3, name: "Sofa" },
    { kind: "symbol", symbol: "table", x: 0.7, y: 0.27, tone: "dark", size: 0.15, at: 0.9, name: "Table" },
    { kind: "symbol", symbol: "bed", x: 0.2, y: 0.74, tone: "dark", size: 0.17, at: 1.5, name: "Bed" },
    { kind: "symbol", symbol: "bath", x: 0.825, y: 0.82, tone: "dark", size: 0.15, at: 2.1, name: "Bath" },
  ] },
  { v: 1, id: "remodel", name: "Remodel", group: "Property", sample: "plan", hint: "What goes and what is new", parts: [
    { kind: "zone", x: 0.51, y: 0.1, w: 0.05, h: 0.33, tone: "danger", fill: 0.35, border: "dashed", at: 0.2, name: "Wall to remove", set: "Remove" },
    { kind: "pill", text: "Remove", x: 0.36, y: 0.26, tone: "danger", size: "sm", at: 0.4, set: "Remove" },
    { kind: "zone", x: 0.536, y: 0.46, w: 0.17, h: 0.15, tone: "success", fill: 0.3, at: 1.2, name: "New storage", set: "New" },
    { kind: "pill", text: "New", x: 0.82, y: 0.535, tone: "success", size: "sm", at: 1.4, set: "New" },
  ] },
  { v: 1, id: "key-feature", name: "Key feature", group: "Property", sample: "plan", hint: "A spotlight on one place and a caption", parts: [
    { kind: "ring", x: 0.304, y: 0.2, d: 0.34, tone: "accent", anim: { type: "spotlight", seconds: 2.4, set: "Panoramic windows" }, name: "Spotlight", set: "Panoramic windows" },
    { kind: "pill", text: "Panoramic windows", x: 0.5, y: 0.84, at: 0.6, set: "Panoramic windows" },
  ] },
  { v: 1, id: "dimensions", name: "Dimensions", group: "Property", sample: "plan", hint: "Measure lines with numbers along the walls", parts: [
    { kind: "line", from: [0.085, 0.14], to: [0.522, 0.14], arrow: "both", tone: "info", weight: "thin", at: 0, set: "4.60 m" },
    { kind: "pill", text: "4.60 m", x: 0.304, y: 0.24, size: "sm", at: 0.2, set: "4.60 m" },
    { kind: "line", from: [0.13, 0.09], to: [0.13, 0.53], arrow: "both", tone: "info", weight: "thin", at: 0.8, set: "3.50 m" },
    { kind: "pill", text: "3.50 m", x: 0.25, y: 0.42, size: "sm", at: 1, set: "3.50 m" },
  ] },
  { v: 1, id: "listing", name: "Listing", group: "Property", sample: "plan", hint: "What it is, the price and what to do next", parts: [
    { kind: "pill", text: "2 rooms · 47 m²", x: 0.5, y: 0.14, at: 0 },
    { kind: "pill", text: "$68 000", x: 0.5, y: 0.48, tone: "accent", size: "lg", at: 0.7, anim: { type: "pop", seconds: 3 }, name: "Price" },
    { kind: "pill", text: "Book a viewing", x: 0.5, y: 0.84, tone: "info", size: "sm", at: 1.6, anim: { type: "heartbeat", seconds: 1.4 }, name: "Call to action" },
  ] },
  { v: 1, id: "zoning", name: "Day & night", group: "Property", sample: "plan", hint: "Two parts of the home in two colours", parts: [
    { kind: "area", points: [[0.071, 0.071], [0.929, 0.071], [0.929, 0.452], [0.536, 0.452], [0.536, 0.548], [0.071, 0.548]], tone: "accent", fill: 0.3, at: 0, name: "Day zone", set: "Day zone" },
    { kind: "pill", text: "Day zone", x: 0.5, y: 0.26, tone: "accent", size: "sm", at: 0.3, set: "Day zone" },
    { kind: "area", points: [[0.071, 0.548], [0.464, 0.548], [0.464, 0.929], [0.071, 0.929]], tone: "info", fill: 0.3, at: 1.2, name: "Night zone", set: "Night zone" },
    { kind: "pill", text: "Night zone", x: 0.268, y: 0.738, tone: "info", size: "sm", at: 1.5, set: "Night zone" },
  ] },
  { v: 1, id: "light-views", name: "Light & views", group: "Property", sample: "plan", hint: "Arrows at the windows: where the sun and the view are", parts: [
    { kind: "line", from: [0.304, 0.0], to: [0.304, 0.2], arrow: "end", tone: "accent", weight: "bold", at: 0, set: "Morning sun" },
    { kind: "pill", text: "Morning sun", x: 0.304, y: 0.3, size: "sm", at: 0.3, set: "Morning sun" },
    { kind: "line", from: [0.732, 0.0], to: [0.732, 0.2], arrow: "end", tone: "accent", weight: "bold", at: 0.9, set: "Evening sun" },
    { kind: "pill", text: "Evening sun", x: 0.732, y: 0.3, size: "sm", at: 1.2, set: "Evening sun" },
    { kind: "line", from: [0.2, 0.76], to: [0.0, 0.76], arrow: "end", tone: "success", weight: "bold", at: 1.8, set: "Park view" },
    { kind: "pill", text: "Park view", x: 0.3, y: 0.86, tone: "success", size: "sm", at: 2.1, set: "Park view" },
  ] },

  // ---------- Maps ----------
  { v: 1, id: "route-a-b", name: "Route A → B", group: "Maps", sample: "map", hint: "Two points and a line drawn along the streets", parts: [
    { kind: "route", points: [[0.25, 0.9], [0.25, 0.714], [0.714, 0.714], [0.714, 0.286], [0.9, 0.286]], tone: "info", straight: true, at: 0.4, seconds: 2.4, name: "Route" },
    { kind: "badge", text: "A", x: 0.25, y: 0.9, tone: "info", at: 0 },
    { kind: "badge", text: "B", x: 0.9, y: 0.286, tone: "danger", at: 2.7, anim: { type: "pulse", seconds: 1.5 } },
    { kind: "pill", text: "12 min", x: 0.48, y: 0.58, size: "sm", at: 3 },
  ] },
  { v: 1, id: "stops", name: "Stops", group: "Maps", sample: "map", hint: "Numbered stops joined one after another", parts: [
    { kind: "route", points: [[0.25, 0.86], [0.25, 0.286]], tone: "dark", weight: "regular", straight: true, at: 0.3, seconds: 0.6 },
    { kind: "route", points: [[0.25, 0.286], [0.714, 0.286]], tone: "dark", weight: "regular", straight: true, at: 1.2, seconds: 0.6 },
    { kind: "route", points: [[0.714, 0.286], [0.714, 0.8]], tone: "dark", weight: "regular", straight: true, at: 2.1, seconds: 0.6 },
    { kind: "badge", text: "1", x: 0.25, y: 0.86, at: 0 },
    { kind: "badge", text: "2", x: 0.25, y: 0.286, at: 0.9 },
    { kind: "badge", text: "3", x: 0.714, y: 0.286, at: 1.8 },
    { kind: "badge", text: "4", x: 0.714, y: 0.8, at: 2.7 },
  ] },
  { v: 1, id: "you-are-here", name: "You are here", group: "Maps", sample: "map", hint: "A pulsing marker with a label", parts: [
    { kind: "ring", x: 0.482, y: 0.5, d: 0.16, tone: "info", fill: 0.2, anim: { type: "ripple", seconds: 2, set: "You are here" }, name: "Pulse", set: "You are here" },
    { kind: "point", x: 0.482, y: 0.5, tone: "info", name: "Marker", set: "You are here" },
    { kind: "pill", text: "You are here", x: 0.482, y: 0.7, tone: "info", size: "sm", at: 0.4, set: "You are here" },
  ] },
  { v: 1, id: "territory", name: "Territory", group: "Maps", sample: "map", hint: "An outlined area with its name", parts: [
    { kind: "area", points: [[0.27, 0.31], [0.69, 0.31], [0.69, 0.54], [0.56, 0.69], [0.27, 0.69]], tone: "danger", fill: 0.22, anim: { type: "ants", seconds: 2, set: "Plot 14 · 0.6 ha" }, name: "Area", set: "Plot 14 · 0.6 ha" },
    { kind: "pill", text: "Plot 14 · 0.6 ha", x: 0.48, y: 0.49, size: "sm", at: 0.5, set: "Plot 14 · 0.6 ha" },
  ] },
  { v: 1, id: "nearby", name: "What's nearby", group: "Maps", sample: "map", hint: "Your place in the middle, what is around it and how far", parts: [
    { kind: "line", from: [0.482, 0.5], to: [0.14, 0.13], dashed: true, tone: "dark", weight: "thin", at: 0.5 },
    { kind: "line", from: [0.482, 0.5], to: [0.86, 0.47], dashed: true, tone: "dark", weight: "thin", at: 1.2 },
    { kind: "line", from: [0.482, 0.5], to: [0.125, 0.6], dashed: true, tone: "dark", weight: "thin", at: 1.9 },
    { kind: "line", from: [0.482, 0.5], to: [0.6, 0.86], dashed: true, tone: "dark", weight: "thin", at: 2.6 },
    { kind: "badge", text: "", x: 0.482, y: 0.5, tone: "info", name: "Home plate", set: "Home plate" },
    { kind: "symbol", symbol: "home", x: 0.482, y: 0.495, tone: "light", size: 0.09, name: "Home", set: "Home plate" },
    { kind: "symbol", symbol: "school", x: 0.14, y: 0.12, tone: "dark", size: 0.1, at: 0.6, name: "School", set: "5 min" },
    { kind: "pill", text: "5 min", x: 0.14, y: 0.26, size: "sm", at: 0.7, set: "5 min" },
    { kind: "symbol", symbol: "shop", x: 0.86, y: 0.46, tone: "dark", size: 0.1, at: 1.3, name: "Shop", set: "2 min" },
    { kind: "pill", text: "2 min", x: 0.86, y: 0.6, size: "sm", at: 1.4, set: "2 min" },
    { kind: "symbol", symbol: "tree", x: 0.125, y: 0.46, tone: "dark", size: 0.1, at: 2, name: "Park", set: "8 min" },
    { kind: "pill", text: "8 min", x: 0.125, y: 0.6, size: "sm", at: 2.1, set: "8 min" },
    { kind: "symbol", symbol: "bus", x: 0.6, y: 0.86, tone: "dark", size: 0.1, at: 2.7, name: "Bus stop", set: "3 min" },
    { kind: "pill", text: "3 min", x: 0.8, y: 0.88, size: "sm", at: 2.8, set: "3 min" },
  ] },
  { v: 1, id: "radius", name: "Radius", group: "Maps", sample: "map", hint: "Rings around a point: delivery zone, a five-minute walk", parts: [
    { kind: "ring", x: 0.482, y: 0.5, d: 0.72, tone: "info", fill: 0.08, border: "dashed", at: 1.4, name: "Outer ring", set: "5 min walk" },
    { kind: "ring", x: 0.482, y: 0.5, d: 0.48, tone: "info", fill: 0.12, at: 0.8, name: "Middle ring", set: "5 min walk" },
    { kind: "ring", x: 0.482, y: 0.5, d: 0.24, tone: "info", fill: 0.2, at: 0.2, name: "Inner ring", set: "5 min walk" },
    { kind: "point", x: 0.482, y: 0.5, tone: "info", anim: { type: "ripple", seconds: 2, set: "5 min walk" }, name: "Centre", set: "5 min walk" },
    { kind: "pill", text: "5 min walk", x: 0.482, y: 0.3, size: "sm", at: 1, set: "5 min walk" },
  ] },
  { v: 1, id: "get-here", name: "How to get here", group: "Maps", sample: "map", hint: "From the stop to your door, with the walking time", parts: [
    { kind: "symbol", symbol: "bus", x: 0.08, y: 0.59, tone: "dark", size: 0.1, at: 0, name: "Bus stop" },
    { kind: "route", points: [[0.08, 0.714], [0.714, 0.714], [0.714, 0.42]], tone: "info", straight: true, at: 0.4, seconds: 2, name: "Walk" },
    { kind: "symbol", symbol: "pin", x: 0.714, y: 0.33, tone: "danger", size: 0.12, at: 2.4, anim: { type: "bounce", seconds: 1 }, set: "We are here" },
    { kind: "pill", text: "We are here", x: 0.714, y: 0.14, tone: "danger", size: "sm", at: 2.6, set: "We are here" },
    { kind: "pill", text: "4 min walk", x: 0.42, y: 0.86, size: "sm", at: 1.4 },
  ] },
  { v: 1, id: "parking", name: "Parking", group: "Maps", sample: "map", hint: "Where to park and where the way in is", parts: [
    { kind: "zone", x: 0.28, y: 0.33, w: 0.4, h: 0.33, tone: "info", fill: 0.3, at: 0, name: "Car park", set: "24 spaces · free" },
    { kind: "badge", text: "P", x: 0.48, y: 0.495, tone: "info", at: 0.2, set: "24 spaces · free" },
    { kind: "line", from: [0.4, 0.86], to: [0.4, 0.68], arrow: "end", tone: "success", weight: "bold", at: 0.9, set: "Way in" },
    { kind: "pill", text: "Way in", x: 0.4, y: 0.92, tone: "success", size: "sm", at: 1.1, set: "Way in" },
    { kind: "pill", text: "24 spaces · free", x: 0.48, y: 0.2, size: "sm", at: 1.6, set: "24 spaces · free" },
  ] },
  { v: 1, id: "two-routes", name: "Two routes", group: "Maps", sample: "map", hint: "The fast way and the other way, each with its time", parts: [
    { kind: "route", points: [[0.25, 0.714], [0.714, 0.714], [0.714, 0.286]], tone: "info", straight: true, at: 0.3, seconds: 1.6, name: "Fast route" },
    { kind: "route", points: [[0.25, 0.714], [0.25, 0.286], [0.714, 0.286]], tone: "success", weight: "regular", straight: true, at: 2, seconds: 1.6, name: "Other route" },
    { kind: "point", x: 0.25, y: 0.714, tone: "dark", name: "Start" },
    { kind: "point", x: 0.714, y: 0.286, tone: "danger", anim: { type: "ripple", seconds: 2 }, name: "Finish" },
    { kind: "pill", text: "8 min", x: 0.5, y: 0.83, tone: "info", size: "sm", at: 1.9 },
    { kind: "pill", text: "12 min", x: 0.44, y: 0.17, tone: "success", size: "sm", at: 3.6 },
  ] },
  { v: 1, id: "day-plan", name: "Day plan", group: "Maps", sample: "map", hint: "Places in order, each with its time", parts: [
    { kind: "route", points: [[0.25, 0.286], [0.714, 0.286]], tone: "dark", weight: "regular", straight: true, at: 0.6, seconds: 0.7 },
    { kind: "route", points: [[0.714, 0.286], [0.714, 0.714], [0.25, 0.714]], tone: "dark", weight: "regular", straight: true, at: 1.9, seconds: 0.9 },
    { kind: "badge", text: "1", x: 0.25, y: 0.286, at: 0, set: "10:00 Museum" },
    { kind: "pill", text: "10:00 Museum", x: 0.27, y: 0.1, size: "sm", at: 0.2, set: "10:00 Museum" },
    { kind: "badge", text: "2", x: 0.714, y: 0.286, at: 1.3, set: "12:30 Lunch" },
    { kind: "pill", text: "12:30 Lunch", x: 0.74, y: 0.47, size: "sm", at: 1.5, set: "12:30 Lunch" },
    { kind: "badge", text: "3", x: 0.25, y: 0.714, at: 2.8, set: "15:00 Park" },
    { kind: "pill", text: "15:00 Park", x: 0.3, y: 0.9, size: "sm", at: 3, set: "15:00 Park" },
  ] },
  { v: 1, id: "delivery-zones", name: "Delivery zones", group: "Maps", sample: "map", hint: "Districts in different colours with a price on each", parts: [
    { kind: "area", points: [[0, 0], [0.25, 0], [0.25, 1], [0, 1]], tone: "info", fill: 0.25, at: 0.8, name: "West", set: "+$2" },
    { kind: "area", points: [[0.25, 0], [0.714, 0], [0.714, 1], [0.25, 1]], tone: "success", fill: 0.25, at: 0, name: "Centre", set: "Free" },
    { kind: "area", points: [[0.714, 0], [1, 0], [1, 1], [0.714, 1]], tone: "danger", fill: 0.25, at: 1.6, name: "East", set: "+$4" },
    { kind: "pill", text: "Free", x: 0.482, y: 0.5, tone: "success", at: 0.2, set: "Free" },
    { kind: "pill", text: "+$2", x: 0.125, y: 0.5, tone: "info", size: "sm", at: 1, set: "+$2" },
    { kind: "pill", text: "+$4", x: 0.857, y: 0.5, tone: "danger", size: "sm", at: 1.8, set: "+$4" },
  ] },
  { v: 1, id: "meeting-point", name: "Meeting point", group: "Maps", sample: "map", hint: "A pin on the spot, with the time", parts: [
    { kind: "ring", x: 0.25, y: 0.286, d: 0.14, tone: "danger", fill: 0.2, anim: { type: "ripple", seconds: 2, set: "Meet here · 18:00" }, name: "Pulse", set: "Meet here · 18:00" },
    { kind: "symbol", symbol: "pin", x: 0.25, y: 0.2, tone: "danger", size: 0.12, at: 0, anim: { type: "bounce", seconds: 1 }, set: "Meet here · 18:00" },
    { kind: "pill", text: "Meet here · 18:00", x: 0.4, y: 0.48, size: "sm", at: 0.5, set: "Meet here · 18:00" },
  ] },
  { v: 1, id: "detour", name: "Road closed", group: "Maps", sample: "map", hint: "The closed stretch and the way around it", parts: [
    { kind: "zone", x: 0.3, y: 0.68, w: 0.37, h: 0.07, tone: "danger", fill: 0.45, border: "none", at: 0, name: "Closed stretch", set: "Closed" },
    { kind: "symbol", symbol: "cross", x: 0.482, y: 0.714, tone: "danger", size: 0.1, at: 0.2, anim: { type: "pulse", seconds: 1.4, set: "Closed" }, name: "Closed", set: "Closed" },
    { kind: "pill", text: "Closed", x: 0.482, y: 0.88, tone: "danger", size: "sm", at: 0.4, set: "Closed" },
    { kind: "route", points: [[0.1, 0.714], [0.25, 0.714], [0.25, 0.286], [0.714, 0.286], [0.714, 0.714], [0.9, 0.714]], tone: "success", straight: true, at: 1, seconds: 2.4, name: "Detour" },
    { kind: "pill", text: "Detour", x: 0.482, y: 0.14, tone: "success", size: "sm", at: 3.2 },
  ] },

  // ---------- Social: posts and stories ----------
  { v: 1, id: "intro-outro", name: "Intro & outro", group: "Social", sample: "photo", hint: "A title at the start and a closing line at the end", parts: [
    { kind: "pill", text: "Apartment tour", x: 0.5, y: 0.16, tone: "accent", size: "lg", at: 0, until: 2.4, name: "Title", set: "Apartment tour" },
    { kind: "pill", text: "47 m² · 2 rooms", x: 0.5, y: 0.34, size: "sm", at: 0.4, until: 2.4, name: "Subtitle", set: "Apartment tour" },
    { kind: "pill", text: "Book a viewing", x: 0.5, y: 0.86, tone: "accent", at: 4.5, anim: { type: "heartbeat", seconds: 1.4 }, name: "Call to action" },
  ] },
  { v: 1, id: "title-card", name: "Title card", group: "Social", sample: "photo", hint: "A name and one line under it, bottom left", parts: [
    { kind: "pill", text: "Riverside 12", x: 0.4, y: 0.72, tone: "light", size: "lg", at: 0, name: "Title", set: "Riverside 12" },
    { kind: "pill", text: "2 rooms · 47 m²", x: 0.31, y: 0.89, size: "sm", at: 0.4, name: "Subtitle", set: "Riverside 12" },
  ] },
  { v: 1, id: "price-tag", name: "Price tag", group: "Social", sample: "photo", hint: "The price, large, in the corner", parts: [
    { kind: "pill", text: "For sale", x: 0.74, y: 0.1, size: "sm", at: 0, set: "For sale" },
    { kind: "pill", text: "$68 000", x: 0.74, y: 0.27, tone: "accent", size: "lg", at: 0.4, anim: { type: "pop", seconds: 3, set: "For sale" }, name: "Price", set: "For sale" },
  ] },
  { v: 1, id: "sale", name: "Sale", group: "Social", sample: "photo", hint: "A discount that pulses, with the deadline", parts: [
    { kind: "pill", text: "−20%", x: 0.5, y: 0.4, tone: "danger", size: "lg", at: 0, anim: { type: "heartbeat", seconds: 1.4, set: "−20%" }, name: "Discount", set: "−20%" },
    { kind: "pill", text: "This week only", x: 0.5, y: 0.6, at: 0.5, set: "−20%" },
  ] },
  { v: 1, id: "review", name: "Review", group: "Social", sample: "photo", hint: "Five stars, a quote and who said it", parts: [
    { kind: "symbol", symbol: "star", x: 0.3, y: 0.26, tone: "accent", size: 0.09, at: 0, name: "Star 1", set: "Star 1" },
    { kind: "symbol", symbol: "star", x: 0.4, y: 0.26, tone: "accent", size: 0.09, at: 0.15, name: "Star 2", set: "Star 1" },
    { kind: "symbol", symbol: "star", x: 0.5, y: 0.26, tone: "accent", size: 0.09, at: 0.3, name: "Star 3", set: "Star 1" },
    { kind: "symbol", symbol: "star", x: 0.6, y: 0.26, tone: "accent", size: 0.09, at: 0.45, name: "Star 4", set: "Star 1" },
    { kind: "symbol", symbol: "star", x: 0.7, y: 0.26, tone: "accent", size: 0.09, at: 0.6, name: "Star 5", set: "Star 1" },
    { kind: "pill", text: "“Felt like home”", x: 0.5, y: 0.48, tone: "light", at: 0.9, name: "Quote", set: "“Felt like home”" },
    { kind: "pill", text: "Anna, guest", x: 0.5, y: 0.66, size: "sm", at: 1.3, name: "Author", set: "“Felt like home”" },
  ] },
  { v: 1, id: "call-to-action", name: "Call to action", group: "Social", sample: "photo", hint: "A button-like line at the bottom that pulses", parts: [
    { kind: "pill", text: "Book a viewing", x: 0.5, y: 0.74, tone: "accent", at: 0, anim: { type: "heartbeat", seconds: 1.4, set: "Book a viewing" }, name: "Call to action", set: "Book a viewing" },
    { kind: "pill", text: "Link in bio", x: 0.5, y: 0.9, size: "sm", at: 0.6, set: "Book a viewing" },
  ] },
  { v: 1, id: "three-reasons", name: "Three reasons", group: "Social", sample: "photo", hint: "A tick and a short line, three times", parts: [
    { kind: "badge", text: "", x: 0.12, y: 0.24, tone: "success", at: 0, name: "Plate 1", set: "Sunny side" },
    { kind: "symbol", symbol: "check", x: 0.12, y: 0.24, tone: "dark", size: 0.08, at: 0, name: "Tick 1", set: "Sunny side" },
    { kind: "pill", text: "Sunny side", x: 0.42, y: 0.24, size: "sm", at: 0.2, set: "Sunny side" },
    { kind: "badge", text: "", x: 0.12, y: 0.5, tone: "success", at: 0.9, name: "Plate 2", set: "Park nearby" },
    { kind: "symbol", symbol: "check", x: 0.12, y: 0.5, tone: "dark", size: 0.08, at: 0.9, name: "Tick 2", set: "Park nearby" },
    { kind: "pill", text: "Park nearby", x: 0.436, y: 0.5, size: "sm", at: 1.1, set: "Park nearby" },
    { kind: "badge", text: "", x: 0.12, y: 0.76, tone: "success", at: 1.8, name: "Plate 3", set: "New kitchen" },
    { kind: "symbol", symbol: "check", x: 0.12, y: 0.76, tone: "dark", size: 0.08, at: 1.8, name: "Tick 3", set: "New kitchen" },
    { kind: "pill", text: "New kitchen", x: 0.436, y: 0.76, size: "sm", at: 2, set: "New kitchen" },
  ] },
  { v: 1, id: "handle", name: "Your handle", group: "Social", sample: "photo", hint: "Your name in the corner for the whole video", parts: [
    { kind: "pill", text: "@yourname", x: 0.2, y: 0.1, size: "sm", name: "Handle" },
  ] },
  { v: 1, id: "new-arrival", name: "New arrival", group: "Social", sample: "photo", hint: "A ring around the new thing and a tag next to it", parts: [
    { kind: "ring", x: 0.446, y: 0.24, d: 0.24, tone: "accent", anim: { type: "pulse", seconds: 1.6, set: "New" }, name: "Ring", set: "New" },
    { kind: "pill", text: "New", x: 0.66, y: 0.42, tone: "danger", at: 0.4, anim: { type: "swing", seconds: 1.6, set: "New" }, name: "Tag", set: "New" },
  ] },
  { v: 1, id: "more-photos", name: "More photos", group: "Social", sample: "photo", hint: "An arrow that runs to the right: swipe on", parts: [
    { kind: "pill", text: "More photos", x: 0.36, y: 0.88, size: "sm", at: 0, set: "More photos" },
    { kind: "line", from: [0.6, 0.88], to: [0.92, 0.88], arrow: "end", tone: "light", weight: "bold", at: 0.3, set: "More photos" },
  ] },
  { v: 1, id: "lower-third", name: "Name plate", group: "Social", sample: "photo", hint: "Who is speaking: a name and a role, then gone", parts: [
    { kind: "pill", text: "Anna Kovalenko", x: 0.32, y: 0.73, tone: "light", at: 0.3, until: 4.5, name: "Name", set: "Anna Kovalenko" },
    { kind: "pill", text: "Real estate agent", x: 0.316, y: 0.89, tone: "accent", size: "sm", at: 0.6, until: 4.5, name: "Role", set: "Anna Kovalenko" },
  ] },

  // ---------- Guides: screenshots and instructions ----------
  { v: 1, id: "steps", name: "Steps 1-2-3", group: "Guides", sample: "screen", hint: "Numbered steps with a line of text each", parts: [
    { kind: "badge", text: "1", x: 0.12, y: 0.24, at: 0, set: "Open reports" },
    { kind: "pill", text: "Open reports", x: 0.44, y: 0.24, size: "sm", at: 0.25, set: "Open reports" },
    { kind: "badge", text: "2", x: 0.12, y: 0.5, at: 0.9, set: "Pick a month" },
    { kind: "pill", text: "Pick a month", x: 0.44, y: 0.5, size: "sm", at: 1.15, set: "Pick a month" },
    { kind: "badge", text: "3", x: 0.12, y: 0.76, at: 1.8, set: "Press Export" },
    { kind: "pill", text: "Press Export", x: 0.44, y: 0.76, size: "sm", at: 2.05, set: "Press Export" },
  ] },
  { v: 1, id: "tap-here", name: "Tap here", group: "Guides", sample: "screen", hint: "A pulsing spot on a button and a hint", parts: [
    { kind: "ring", x: 0.83, y: 0.874, d: 0.14, tone: "accent", fill: 0.3, anim: { type: "ripple", seconds: 1.6, set: "Tap here" }, name: "Tap spot", set: "Tap here" },
    { kind: "pill", text: "Tap here", x: 0.82, y: 0.68, tone: "accent", size: "sm", at: 0.4, set: "Tap here" },
  ] },
  { v: 1, id: "callouts", name: "Callouts", group: "Guides", sample: "screen", hint: "A dot, a leader line and a note, three times", parts: [
    { kind: "line", from: [0.554, 0.3], to: [0.36, 0.16], tone: "dark", weight: "thin", at: 0.15, set: "Best month" },
    { kind: "ring", x: 0.554, y: 0.3, d: 0.035, tone: "danger", fill: 1, at: 0, set: "Best month" },
    { kind: "pill", text: "Best month", x: 0.36, y: 0.16, size: "sm", at: 0.3, set: "Best month" },
    { kind: "line", from: [0.76, 0.26], to: [0.8, 0.46], tone: "dark", weight: "thin", at: 0.95, set: "Revenue" },
    { kind: "ring", x: 0.76, y: 0.26, d: 0.035, tone: "danger", fill: 1, at: 0.8, set: "Revenue" },
    { kind: "pill", text: "Revenue", x: 0.8, y: 0.46, size: "sm", at: 1.1, set: "Revenue" },
    { kind: "line", from: [0.4, 0.75], to: [0.44, 0.92], tone: "dark", weight: "thin", at: 1.75, set: "Latest orders" },
    { kind: "ring", x: 0.4, y: 0.75, d: 0.035, tone: "danger", fill: 1, at: 1.6, set: "Latest orders" },
    { kind: "pill", text: "Latest orders", x: 0.44, y: 0.92, size: "sm", at: 1.9, set: "Latest orders" },
  ] },
  { v: 1, id: "click-path", name: "Click path", group: "Guides", sample: "screen", hint: "Where to click, in order, joined by arrows", parts: [
    { kind: "line", from: [0.093, 0.245], to: [0.4, 0.38], arrow: "end", dashed: true, tone: "dark", weight: "thin", at: 0.5 },
    { kind: "line", from: [0.44, 0.4], to: [0.79, 0.82], arrow: "end", dashed: true, tone: "dark", weight: "thin", at: 1.4 },
    { kind: "badge", text: "1", x: 0.093, y: 0.245, at: 0 },
    { kind: "badge", text: "2", x: 0.44, y: 0.4, at: 0.9 },
    { kind: "badge", text: "3", x: 0.83, y: 0.874, at: 1.8, anim: { type: "pulse", seconds: 1.4 } },
  ] },
  { v: 1, id: "whats-new", name: "What's new", group: "Guides", sample: "screen", hint: "A frame around the new part and what it does", parts: [
    { kind: "zone", x: 0.689, y: 0.619, w: 0.282, h: 0.343, tone: "accent", fill: 0.12, at: 0, anim: { type: "ants", seconds: 2, set: "New" }, name: "Frame", set: "New" },
    { kind: "pill", text: "New", x: 0.83, y: 0.56, tone: "accent", size: "sm", at: 0.3, anim: { type: "swing", seconds: 1.6 }, set: "New" },
    { kind: "pill", text: "One-click export", x: 0.4, y: 0.8, size: "sm", at: 0.8 },
  ] },
  { v: 1, id: "guided-tour", name: "Guided tour", group: "Guides", sample: "screen", hint: "One part of the screen at a time, each with its name", parts: [
    { kind: "zone", x: 0, y: 0, w: 0.186, h: 1, tone: "info", fill: 0.25, at: 0, until: 1.6, name: "Menu frame", set: "Menu" },
    { kind: "pill", text: "Menu", x: 0.3, y: 0.24, tone: "info", size: "sm", at: 0.2, until: 1.6, set: "Menu" },
    { kind: "zone", x: 0.214, y: 0.152, w: 0.446, h: 0.429, tone: "info", fill: 0.25, at: 1.6, until: 3.2, name: "Chart frame", set: "Sales by month" },
    { kind: "pill", text: "Sales by month", x: 0.437, y: 0.66, tone: "info", size: "sm", at: 1.8, until: 3.2, set: "Sales by month" },
    { kind: "zone", x: 0.689, y: 0.619, w: 0.282, h: 0.343, tone: "info", fill: 0.25, at: 3.2, name: "Export frame", set: "Export" },
    { kind: "pill", text: "Export", x: 0.83, y: 0.54, tone: "info", size: "sm", at: 3.4, set: "Export" },
  ] },
  { v: 1, id: "remarks", name: "Remarks", group: "Guides", sample: "screen", hint: "Circled problems, numbered", parts: [
    { kind: "ring", x: 0.44, y: 0.37, d: 0.2, tone: "danger", at: 0, anim: { type: "pulse", seconds: 1.4 }, set: "Ring" },
    { kind: "badge", text: "1", x: 0.56, y: 0.22, tone: "danger", at: 0.2, set: "Ring" },
    { kind: "ring", x: 0.83, y: 0.483, d: 0.2, tone: "danger", at: 0.9, anim: { type: "pulse", seconds: 1.4 }, set: "Ring" },
    { kind: "badge", text: "2", x: 0.93, y: 0.33, tone: "danger", at: 1.1, set: "Ring" },
    { kind: "ring", x: 0.4, y: 0.8, d: 0.2, tone: "danger", at: 1.8, anim: { type: "pulse", seconds: 1.4 }, set: "Ring" },
    { kind: "badge", text: "3", x: 0.52, y: 0.66, tone: "danger", at: 2, set: "Ring" },
  ] },
  { v: 1, id: "do-dont", name: "Do / Don't", group: "Guides", sample: "screen", hint: "A tick on the right way and a cross on the wrong one", parts: [
    { kind: "zone", x: 0.214, y: 0.152, w: 0.446, h: 0.429, tone: "success", fill: 0.22, at: 0, name: "Right way", set: "Do" },
    { kind: "symbol", symbol: "check", x: 0.437, y: 0.36, tone: "success", size: 0.14, at: 0.2, name: "Tick", set: "Do" },
    { kind: "pill", text: "Do", x: 0.6, y: 0.2, tone: "success", size: "sm", at: 0.3, set: "Do" },
    { kind: "zone", x: 0.214, y: 0.619, w: 0.446, h: 0.343, tone: "danger", fill: 0.22, at: 1.2, name: "Wrong way", set: "Don't" },
    { kind: "symbol", symbol: "cross", x: 0.437, y: 0.79, tone: "danger", size: 0.12, at: 1.4, name: "Cross", set: "Don't" },
    { kind: "pill", text: "Don't", x: 0.58, y: 0.67, tone: "danger", size: "sm", at: 1.5, set: "Don't" },
  ] },
  { v: 1, id: "warning", name: "Warning", group: "Guides", sample: "screen", hint: "A circle, a warning mark and a line of text", parts: [
    { kind: "ring", x: 0.83, y: 0.483, d: 0.24, tone: "danger", at: 0, anim: { type: "pulse", seconds: 1.4, set: "Check this first" }, name: "Circle", set: "Check this first" },
    { kind: "badge", text: "!", x: 0.68, y: 0.3, tone: "danger", at: 0.2, anim: { type: "shake", seconds: 1.2, set: "Check this first" }, name: "Warning sign", set: "Check this first" },
    { kind: "pill", text: "Check this first", x: 0.4, y: 0.66, tone: "danger", size: "sm", at: 0.5, set: "Check this first" },
  ] },
  { v: 1, id: "compare", name: "Compare A / B", group: "Guides", sample: "photo", hint: "Two options side by side", parts: [
    { kind: "zone", x: 0.04, y: 0.1, w: 0.44, h: 0.66, tone: "info", fill: 0.25, at: 0, name: "Side A", set: "Option A" },
    { kind: "zone", x: 0.52, y: 0.1, w: 0.44, h: 0.66, tone: "danger", fill: 0.25, at: 0.8, name: "Side B", set: "Option B" },
    { kind: "pill", text: "Option A", x: 0.26, y: 0.87, tone: "info", size: "sm", at: 0.2, set: "Option A" },
    { kind: "pill", text: "Option B", x: 0.74, y: 0.87, tone: "danger", size: "sm", at: 1, set: "Option B" },
    { kind: "badge", text: "vs", x: 0.5, y: 0.43, tone: "light", at: 1.4, anim: { type: "pop", seconds: 3 } },
  ] },
  { v: 1, id: "evacuation", name: "Evacuation", group: "Guides", sample: "plan", hint: "Where you are and the way out", parts: [
    { kind: "route", points: [[0.268, 0.72], [0.44, 0.645], [0.56, 0.68], [0.589, 0.9]], tone: "success", at: 0.6, seconds: 1.8, name: "Way out" },
    { kind: "point", x: 0.268, y: 0.72, tone: "info", anim: { type: "ripple", seconds: 2, set: "You are here" }, name: "You", set: "You are here" },
    { kind: "pill", text: "You are here", x: 0.268, y: 0.86, tone: "info", size: "sm", at: 0.2, set: "You are here" },
    { kind: "symbol", symbol: "exit", x: 0.66, y: 0.83, tone: "success", size: 0.1, at: 2.2, anim: { type: "pulse", seconds: 1.4 }, name: "Exit" },
  ] },
];

/** Library previews are built on a small stage, so labels and lines stay readable at tile size. */
export const PREVIEW_W = 560, PREVIEW_H = 420;

export const LIBRARY: TemplateSpec[] = RAW.map(parseTemplate).filter((t): t is TemplateSpec => t !== null);
/** The bundled templates in the current language. */
export const library = (): TemplateSpec[] => LIBRARY.map(localizeTemplate);
if (import.meta.env.DEV && LIBRARY.length !== RAW.length) console.warn(`Template library: ${RAW.length - LIBRARY.length} bundled template(s) failed validation`);
