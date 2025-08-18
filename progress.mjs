import { promises as fs } from "fs";

const PROGRESS_FILE = "./progress.json";

export async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { completed: [] }; // empty progress if file doesn’t exist
  }
}

export async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}
