import { describe, it, expect } from 'vitest';
import { resolveRole } from '../src/lib/auth';

const env = { OWNER_PASSWORD: 'owner-x', EMPLOYEE_PASSWORD: 'emp-x', VIEWER_PIN: 'view-x' };

describe('resolveRole', () => {
  it('maps the owner PIN to OWNER', () => {
    expect(resolveRole('owner-x', env)).toBe('OWNER');
  });

  it('maps the employee PIN to EMPLOYEE', () => {
    expect(resolveRole('emp-x', env)).toBe('EMPLOYEE');
  });

  it('maps the viewer PIN to VIEWER', () => {
    expect(resolveRole('view-x', env)).toBe('VIEWER');
  });

  it('returns null for an unknown PIN', () => {
    expect(resolveRole('nope', env)).toBeNull();
  });

  it('never returns VIEWER when VIEWER_PIN is unset', () => {
    expect(resolveRole('', { OWNER_PASSWORD: 'o', EMPLOYEE_PASSWORD: 'e' })).toBeNull();
    expect(resolveRole('view-x', { OWNER_PASSWORD: 'o', EMPLOYEE_PASSWORD: 'e' })).toBeNull();
  });

  it('returns null when owner/employee PINs are not configured', () => {
    expect(resolveRole('anything', {})).toBeNull();
  });
});
