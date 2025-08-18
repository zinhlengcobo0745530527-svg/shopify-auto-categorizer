export async function processQueue(items, worker, concurrency = 2) {
  const results = [];
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        const result = await worker(items[currentIndex]);
        results[currentIndex] = result;
      } catch (err) {
        console.error(`❌ Error processing item ${currentIndex}:`, err.message);
        results[currentIndex] = null;
      }
    }
  }

  // start workers
  const workers = Array.from({ length: concurrency }, runWorker);
  await Promise.all(workers);

  return results;
}
