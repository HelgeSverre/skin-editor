import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { existsSync } from "fs";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";

// Copy skin asset directories into dist during build
function copySkinsPlugin() {
  const skinDirs = ["skins-repo", "skins"];
  return {
    name: "copy-skins",
    writeBundle(options) {
      const outDir = options.dir || "dist";
      for (const dir of skinDirs) {
        const src = resolve(dir);
        if (existsSync(src)) {
          copyDirRecursive(src, resolve(outDir, dir));
        }
      }
    },
  };
}

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  plugins: [svelte(), copySkinsPlugin()],
});
