import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "assets");
const targetRoot = resolve(root, "public");
const target = resolve(targetRoot, "assets");

await mkdir(targetRoot, { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log("Synced ./assets -> ./public/assets");
