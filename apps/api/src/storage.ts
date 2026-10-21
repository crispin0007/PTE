import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/** Where recordings live. Local disk now; an S3-compatible store (R2, MinIO) slots in later. */
export type Storage = {
  put: (key: string, data: Buffer) => Promise<void>;
  get: (key: string) => Promise<Buffer | null>;
  delete: (key: string) => Promise<void>;
};

export function diskStorage(root: string): Storage {
  const base = resolve(root);
  const path = (key: string) => {
    const p = resolve(join(base, key));
    if (!p.startsWith(base + '/')) throw new Error('invalid storage key');
    return p;
  };
  return {
    async put(key, data) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), data);
    },
    async get(key) {
      try {
        return await readFile(path(key));
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(path(key), { force: true });
    },
  };
}

/** For tests. */
export function memoryStorage(): Storage {
  const m = new Map<string, Buffer>();
  return {
    put: async (k, d) => void m.set(k, d),
    get: async (k) => m.get(k) ?? null,
    delete: async (k) => void m.delete(k),
  };
}
