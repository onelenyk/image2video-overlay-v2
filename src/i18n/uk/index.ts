import { start, startPlurals } from "./start";
import { editor, editorPlurals } from "./editor";
import { panels, panelsPlurals } from "./panels";
import { core, corePlurals } from "./core";

// Ukrainian texts, in parts by area of the app. The key is the English text.
export const uk = { ...start, ...editor, ...panels, ...core } as const;
/** Counted texts: [one, few, many], e.g. 1 оверлей, 2 оверлеї, 5 оверлеїв. */
export const ukPlurals = { ...startPlurals, ...editorPlurals, ...panelsPlurals, ...corePlurals } as const;
