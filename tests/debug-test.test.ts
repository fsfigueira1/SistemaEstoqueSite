import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { prisma } from './setup';
import { Role } from '../src/generated/prisma/enums';

describe('Debug Test', () => {
  beforeEach(async () => {
    // Clear any existing data
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    // Clean up after tests
    await prisma.user.deleteMany();
  });

  it('should create a user with proper enum values', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'debug@test.com',
        name: 'Debug User',
        password: 'hashed_password_123',
        role: Role.ADMIN,
        status: 'ACTIVE' as const
      }
    });

    expect(user).toBeDefined();
    expect(user.email).toBe('debug@test.com');
    expect(user.name).toBe('Debug User');
    expect(user.role).toBe('ADMIN');
    expect(user.status).toBe('ACTIVE');
  });

  it('should find users by role', async () => {
    // Create test users
    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin User',
        password: 'hashed_password_123',
        role: Role.ADMIN,
        status: 'ACTIVE' as const
      }
    });

    await prisma.user.create({
      data: {
        email: 'user@test.com',
        name: 'Regular User',
        password: 'hashed_password_123',
        role: Role.USER,
        status: 'ACTIVE' as const
      }
    });

    // Find admins
    const admins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN
      }
    });

    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe('admin@test.com');

    // Find regular users
    const regularUsers = await prisma.user.findMany({
      where: {
        role: Role.USER
      }
    });

    expect(regularUsers).toHaveLength(1);
    expect(regularUsers[0].email).toBe('user@test.com');
  });
});
