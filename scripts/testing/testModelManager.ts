import { ModelManager } from "../src/ModelManager";

async function main() {
  const basePath = "./.cache";
  const manager = new ModelManager(basePath);

  // Check if models dir was created
  console.log("Storage path exists:", manager);
}

main();
