import { expect } from 'vitest';
import { retryWork } from '../../helpers';

export async function retryQuery<T>(getter: () => T | Promise<T>): Promise<T> {
  const work = await retryWork({
    getter,
    retry: 6,
    interval: 8000,
  });

  expect(work.success).toEqual(true);
  return work.result as T;
}
