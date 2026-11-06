// Lance les émulateurs Auth + Firestore et conserve les données entre deux lancements (dossier emulator-data/).
// Les émulateurs ont besoin de Java 21+ : si `java` n'est pas dans le PATH (ou trop ancien),
// le script cherche un JDK installé (IntelliJ ~/.jdks, Program Files…) et l'utilise pour ce lancement.
import { existsSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const MIN_JAVA = 21;
const isWin = process.platform === "win32";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "emulator-data");

/** Version majeure du `java` trouvé dans l'environnement donné, ou null. */
function javaMajor(env) {
  const r = spawnSync("java", ["-version"], { env, shell: true, encoding: "utf8" });
  if (r.status !== 0) return null;
  const m = /version "(\d+)(?:\.(\d+))?/.exec(r.stderr + r.stdout);
  if (!m) return null;
  return m[1] === "1" ? Number(m[2]) : Number(m[1]); // "1.8" => 8
}

/** JDK installés sur la machine, du plus récent au plus ancien. */
function findJdks() {
  const home = os.homedir();
  const bases = [path.join(home, ".jdks")];
  if (isWin) {
    for (const pf of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      for (const vendor of ["Java", "Eclipse Adoptium", "Microsoft", "Amazon Corretto", "Zulu", "BellSoft"]) {
        bases.push(path.join(pf, vendor));
      }
    }
  } else {
    bases.push("/usr/lib/jvm", "/Library/Java/JavaVirtualMachines");
  }
  const javaBin = (dir) => path.join(dir, "bin", isWin ? "java.exe" : "java");
  const found = [];
  if (process.env.JAVA_HOME) bases.unshift(path.dirname(process.env.JAVA_HOME));
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      for (const dir of [path.join(base, name), path.join(base, name, "Contents", "Home")]) {
        if (!existsSync(javaBin(dir))) continue;
        const m = /(\d+)(?:\.\d+)*/.exec(name.replace(/^jdk-?1\./, ""));
        found.push({ dir, major: m ? Number(m[1]) : 0, name });
      }
    }
  }
  return found.sort((a, b) => b.major - a.major);
}

/** Copie de l'environnement avec ce JDK en tête du PATH (en respectant "Path" sous Windows). */
function envWithJdk(dir) {
  const env = { ...process.env, JAVA_HOME: dir };
  const key = Object.keys(env).find((k) => k.toLowerCase() === "path") || "PATH";
  env[key] = path.join(dir, "bin") + path.delimiter + (env[key] || "");
  return env;
}

let env = process.env;
const current = javaMajor(env);
if (current === null || current < MIN_JAVA) {
  const jdk = findJdks().find((j) => j.major >= MIN_JAVA && javaMajor(envWithJdk(j.dir)) >= MIN_JAVA);
  if (!jdk) {
    console.error(
      `\n✖ Java ${MIN_JAVA}+ introuvable (trouvé : ${current ?? "aucun"}).\n` +
      `  Installe un JDK ${MIN_JAVA}+ (ex. IntelliJ > File > Project Structure > SDKs > Download JDK, ou https://adoptium.net)\n` +
      `  puis relance "npm run emulators".\n`,
    );
    process.exit(1);
  }
  env = envWithJdk(jdk.dir);
  console.log(`☕ Java ${current ?? "absent"} dans le PATH → utilisation de ${jdk.name} (${jdk.dir})`);
}

let args;
if (process.argv.includes("--test")) {
  // npm run test:rules : émulateur Firestore éphémère + tests des règles
  args = ["emulators:exec", "--only", "firestore", "--project", "demo-ressenti", '"vitest run"'];
} else {
  args = ["emulators:start", "--only", "auth,firestore", "--project", "demo-ressenti", `--export-on-exit="${dataDir}"`];
  if (existsSync(path.join(dataDir, "firebase-export-metadata.json"))) args.push(`--import="${dataDir}"`);
}

spawn("firebase", args, { cwd: process.argv.includes("--test") ? path.join(root, "frontend") : root, stdio: "inherit", shell: true, env }).on("exit", (code) => process.exit(code ?? 0));
