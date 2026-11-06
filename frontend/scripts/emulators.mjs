// Lance les émulateurs Auth + Firestore et conserve les données entre deux lancements (dossier emulator-data/).
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "emulator-data");
const args = ["emulators:start", "--only", "auth,firestore", "--project", "demo-ressenti", `--export-on-exit=${dataDir}`];
if (existsSync(path.join(dataDir, "firebase-export-metadata.json"))) args.push(`--import=${dataDir}`);

spawn("firebase", args, { cwd: root, stdio: "inherit", shell: true }).on("exit", (code) => process.exit(code ?? 0));
