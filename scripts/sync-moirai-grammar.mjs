// Copies the Moirai TextMate grammar from the Moirai repo, where it lives beside the engine it
// describes and a drift test pins its keyword and builtin lists to the tokenizer. The blog keeps a
// copy rather than reaching across repos at build time, so it still builds without Moirai checked
// out. Run after the language changes: `yarn sync:moirai` (MOIRAI_REPO overrides ../Moirai).
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(process.env.MOIRAI_REPO ?? "../Moirai");
const from = resolve(repo, "vscode-languageserver/moirai.tmLanguage.json");
const to = resolve("src/langs/moirai.tmLanguage.json");
copyFileSync(from, to);
console.log(`${from} -> ${to}`);
