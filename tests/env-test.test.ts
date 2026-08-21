import { describe, it, expect } from 'vitest';

describe('Environment Test', () => {
  it('should show NODE_ENV', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV);
    expect(process.env.NODE_ENV).toBeDefined();
  });
});