export default class AsyncQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.activeCount = 0;
    this.queue = [];
  }

  async add(task) {
    if (this.activeCount >= this.concurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}

// Global instance for all playwright extractors
export const playwrightQueue = new AsyncQueue(1); // Only 1 browser at a time
