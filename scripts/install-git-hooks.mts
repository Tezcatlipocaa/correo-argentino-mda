import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".git")) {
  try {
    execSync("git config core.hooksPath scripts/git-hooks", { stdio: "ignore" });
    console.log("[install-git-hooks] Hook pre-push configurado en core.hooksPath.");
  } catch {
    // Entornos sin git o submodulos
  }
}
