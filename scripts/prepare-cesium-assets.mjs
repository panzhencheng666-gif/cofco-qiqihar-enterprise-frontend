import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const sourceRoot = resolve("node_modules/cesium/Build/Cesium");
const targetRoot = resolve("public/Cesium");
const requiredDirectories = ["Assets", "ThirdParty", "Widgets", "Workers"];

if (!existsSync(sourceRoot)) {
  throw new Error(
    "CesiumJS runtime assets are unavailable. Run npm install before building.",
  );
}

mkdirSync(targetRoot, { recursive: true });
for (const directory of requiredDirectories) {
  cpSync(resolve(sourceRoot, directory), resolve(targetRoot, directory), {
    force: true,
    recursive: true,
  });
}
