import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { UserService } from '../src/services/userService';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser } from './utils';
import { Role, UserStatus } from '@/generated/prisma/client';

describe('User Service', () => {
  let adminUser: any; // Changed from Prisma.UserModel to any

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser('admin@test.com');
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('getUsers', () => {
    it('should return an empty array when no users exist besides admin', async () => {
      const result = await UserService.getUsers({});
      // Should only return the admin user created in beforeEach
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('admin@test.com');
      expect(result.pagination.total).toBe(1);
    })

    it('should return users with pagination', async () => {
      // Create additional test users
      await prisma.user.createMany({
        data: [
          {
            name: 'User 1',
            email: 'user1@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          },
          {
            name: 'User 2',
            email: 'user2@test.com',
            password: 'password123',
            role: 'ADMIN',
            status: 'ACTIVE'
          }
        ]
      })

      // Test default pagination
      let result = await UserService.getUsers({});
      expect(result.users).toHaveLength(3); // admin + 2 created
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.totalPages).toBe(1)

      // Test custom pagination
      result = await UserService.getUsers({ page: 1, limit: 2 })
      expect(result.users).toHaveLength(2)
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.totalPages).toBe(2)

      // Test second page
      result = await UserService.getUsers({ page: 2, limit: 2 })
      expect(result.users).toHaveLength(1)
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.totalPages).toBe(2)
    })

    it('should filter users by role', async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            name: 'Regular User',
            email: 'user@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          }
        ]
      })

      // Filter by ADMIN role (should only get the admin from beforeEach)
      const result = await UserService.getUsers({ role: 'ADMIN' })
      expect(result.users).toHaveLength(1)
      expect(result.users[0].role).toBe('ADMIN')
      expect(result.users[0].email).toBe('admin@test.com')

      // Filter by USER role
      const result2 = await UserService.getUsers({ role: 'USER' })
      expect(result2.users).toHaveLength(1)
      expect(result2.users[0].role).toBe('USER')
      expect(result2.users[0].email).toBe('user@test.com')
    })

    it('should filter users by status', async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            name: 'Active User',
            email: 'active@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          },
          {
            name: 'Inactive User',
            email: 'inactive@test.com',
            password: 'password123',
            role: 'USER',
            status: 'INACTIVE'
          }
        ]
      })

      // Filter by ACTIVE status
      const result = await UserService.getUsers({ status: 'ACTIVE' })
      expect(result.users).toHaveLength(2) // admin + active user
      expect(result.users.every(u => u.status === 'ACTIVE')).toBe(true)

      // Filter by INACTIVE status
      const result2 = await UserService.getUsers({ status: 'INACTIVE' })
      expect(result2.users).toHaveLength(1)
      expect(result2.users[0].status).toBe('INACTIVE')
      expect(result2.users[0].email).toBe('inactive@test.com')
    })

    it('should search users by name or email', async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          },
          {
            name: 'Jane Smith',
            email: 'jane@test.com',
            password: 'password123',
            role: 'ADMIN',
            status: 'ACTIVE'
          }
        ]
      })

      // Search by name
      let result = await UserService.getUsers({ search: 'John' })
      expect(result.users).toHaveLength(1)
      expect(result.users[0].name).toBe('John Doe')

      // Search by email
      result = await UserService.getUsers({ search: '@example.com' })
      expect(result.users).toHaveLength(1)
      expect(result.users[0].email).toBe('john@example.com')

      // Search with no results
      result = await UserService.getUsers({ search: 'nonexistent' })
      expect(result.users).toHaveLength(0)
    })
  })

  describe('getUserById', () => {
    it('should return user by valid ID', async () => {
      // Create test user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'USER',
          status: 'ACTIVE'
        }
      })

      // Get user by ID
      const user = await UserService.getUserById(createdUser.id)
      expect(user).toBeDefined()
      expect(user.id).toBe(createdUser.id)
      expect(user.name).toBe('Test User')
      expect(user.email).toBe('test@example.com')
      expect(user.role).toBe('USER')
      expect(user.status).toBe('ACTIVE')
      // Password should not be returned for security
      expect(user).not.toHaveProperty('password')
    })

    it('should throw error for non-existent user ID', async () => {
      await expect(UserService.getUserById('non-existent-id'))
        .rejects
        .toThrow('User not found')
    })
  })

  describe('getUserByEmail', () => {
    it('should return user by valid email', async () => {
      // Create test user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'USER',
          status: 'ACTIVE'
        }
      })

      // Get user by email
      const user = await UserService.getUserByEmail('test@example.com')
      expect(user).toBeDefined()
      expect(user?.id).toBe(createdUser.id)
      expect(user?.name).toBe('Test User')
      expect(user?.email).toBe('test@example.com')
      expect(user?.role).toBe('USER')
      expect(user?.status).toBe('ACTIVE')
    })

    it('should return null for non-existent email', async () => {
      const user = await UserService.getUserByEmail('nonexistent@example.com')
      expect(user).toBeNull()
    })
  })

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'securepass123',
        role: 'ADMIN' as Role,
        status: 'ACTIVE' as UserStatus
      }

      const createdUser = await UserService.createUser(userData)
      expect(createdUser).toBeDefined()
      expect(createdUser.id).toBeDefined()
      expect(createdUser.name).toBe('New User')
      expect(createdUser.email).toBe('newuser@example.com')
      expect(createdUser.role).toBe('ADMIN')
      expect(createdUser.status).toBe('ACTIVE')
      // Password should not be returned for security
      expect(createdUser).not.toHaveProperty('password')
    })

    it('should throw error for missing required fields', async () => {
      // Test missing password
      await expect(UserService.createUser({
        name: 'Incomplete User',
        email: 'test@example.com',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      } as any)).rejects.toThrow('Missing required fields')

      // Test missing email
      await expect(UserService.createUser({
        name: 'Incomplete User',
        password: 'password123',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      } as any)).rejects.toThrow('Missing required fields')

      // Test missing name
      await expect(UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      } as any)).rejects.toThrow('Missing required fields')
    })

    it('should throw error for invalid email format', async () => {
      await expect(UserService.createUser({
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      })).rejects.toThrow('Invalid email format')

      await expect(UserService.createUser({
        name: 'Test User',
        email: 'test@',
        password: 'password123',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      })).rejects.toThrow('Invalid email format')
    })

    it('should throw error for short password', async () => {
      await expect(UserService.createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: '123',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      })).rejects.toThrow('Password must be at least 6 characters long')
    })

    it('should throw error for duplicate email', async () => {
      // Create first user
      await UserService.createUser({
        name: 'First User',
        email: 'duplicate@test.com',
        password: 'password123',
        role: 'USER' as Role,
        status: 'ACTIVE' as UserStatus
      })

      // Try to create second user with same email
      await expect(UserService.createUser({
        name: 'Second User',
        email: 'duplicate@test.com',
        password: 'password456',
        role: 'ADMIN' as Role,
        status: 'ACTIVE' as UserStatus
      })).rejects.toThrow('User with this email already exists')
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Create test user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Original Name',
          email: 'original@test.com',
          password: 'originalpass123',
          role: 'USER',
          status: 'ACTIVE'
        }
      })

      // Update user
      const updatedUser = await UserService.updateUser(createdUser.id, {
        name: 'Updated Name',
        email: 'updated@test.com',
        role: 'ADMIN' as Role
      })

      expect(updatedUser).toBeDefined()
      expect(updatedUser.id).toBe(createdUser.id)
      expect(updatedUser.name).toBe('Updated Name')
      expect(updatedUser.email).toBe('updated@test.com')
      expect(updatedUser.role).toBe('ADMIN')
      expect(updatedUser.status).toBe('ACTIVE') // Unchanged
      expect(updatedUser).not.toHaveProperty('password')
    })

    it('should throw error for non-existent user ID', async () => {
      await expect(UserService.updateUser('non-existent-id', {
        name: 'Updated Name'
      })).rejects.toThrow('User not found')
    })

    it('should throw error for invalid email format', async () => {
      // Create test user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          role: 'USER',
          status: 'ACTIVE'
        }
      })

      await expect(UserService.updateUser(createdUser.id, {
        email: 'invalid-email',
        name: undefined as unknown as string,
        password: undefined as unknown as string,
        role: undefined as unknown as Role,
        status: undefined as unknown as UserStatus
      })).rejects.toThrow('Invalid email format')
    })

    it('should throw error for duplicate email', async () => {
      // Create two users
      await prisma.user.createMany({
        data: [
          {
            name: 'User 1',
            email: 'user1@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          },
          {
            name: 'User 2',
            email: 'user2@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          }
        ]
      })

      const user1 = await prisma.user.findUnique({ where: { email: 'user1@test.com' } })
      const user2 = await prisma.user.findUnique({ where: { email: 'user2@test.com' } })

      // Try to update user2 with user1's email
      await expect(UserService.updateUser(user2!.id, {
        email: 'user1@test.com',
        name: undefined as unknown as string,
        password: undefined as unknown as string,
        role: undefined as unknown as Role,
        status: undefined as unknown as UserStatus
      })).rejects.toThrow('User with this email already exists')
    })

    it('should throw error for short password', async () => {
      // Create test user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          }
        })

      await expect(UserService.updateUser(createdUser.id, {
        password: '123',
        name: undefined as unknown as string,
        email: undefined as unknown as string,
        role: undefined as unknown as Role,
        status: undefined as unknown as UserStatus
      })).rejects.toThrow('Password must be at least 6 characters long')
    })
  })

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      // Create test user (not the admin)
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          role: 'USER',
          status: 'ACTIVE'
        }
      })

      // Deactivate user
      const deactivatedUser = await UserService.deactivateUser(createdUser.id)
      expect(deactivatedUser).toBeDefined()
      expect(deactivatedUser.id).toBe(createdUser.id)
      expect(deactivatedUser.status).toBe('INACTIVE')
      expect(deactivatedUser.name).toBe('Test User')
      expect(deactivatedUser.email).toBe('test@test.com')
    })

    it('should throw error for non-existent user ID', async () => {
      await expect(UserService.deactivateUser('non-existent-id'))
        .rejects
        .toThrow('User not found')
    })

    it('should prevent deactivating last admin user', async () => {
      // Try to deactivate the admin user created in beforeEach
      await expect(UserService.deactivateUser(adminUser.id))
        .rejects
        .toThrow('Cannot deactivate the last active admin user')
    })

    it('should allow deactivating admin when other admins exist', async () => {
      // Create another admin user
      const anotherAdmin = await prisma.user.create({
        data: {
          name: 'Another Admin',
          email: 'another@test.com',
          password: 'password123',
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      })

      // Should be able to deactivate the original admin when another exists
      const deactivatedAdmin = await UserService.deactivateUser(adminUser.id)
      expect(deactivatedAdmin.status).toBe('INACTIVE')

      // Other admin should still be active
      const otherAdmin = await UserService.getUserById(anotherAdmin.id)
      expect(otherAdmin.status).toBe('ACTIVE')
    })
  })

  describe('activateUser', () => {
    it('should activate user successfully', async () => {
      // Create inactive user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          role: 'USER',
          status: 'INACTIVE'
        }
      })

      // Activate user
      const activatedUser = await UserService.activateUser(createdUser.id)
      expect(activatedUser).toBeDefined()
      expect(activatedUser.id).toBe(createdUser.id)
      expect(activatedUser.status).toBe('ACTIVE')
      expect(activatedUser.name).toBe('Test User')
      expect(activatedUser.email).toBe('test@test.com')
    })

    it('should throw error for non-existent user ID', async () => {
      await expect(UserService.activateUser('non-existent-id'))
        .rejects
        .toThrow('User not found')
    })
  })

  describe('changeUserRole', () => {
    it('should change user role successfully', async () => {
      // Create test user
      const createdUser = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
          role: 'USER',
          status: 'ACTIVE'
        }
      })

      // Change role to ADMIN
      const updatedUser = await UserService.changeUserRole(createdUser.id, 'ADMIN' as Role)
      expect(updatedUser).toBeDefined()
      expect(updatedUser.id).toBe(createdUser.id)
      expect(updatedUser.role).toBe('ADMIN')
      expect(updatedUser.name).toBe('Test User')
      expect(updatedUser.email).toBe('test@test.com')
      expect(updatedUser.status).toBe('ACTIVE') // Unchanged
    })

    it('should throw error for non-existent user ID', async () => {
      await expect(UserService.changeUserRole('non-existent-id', 'ADMIN'))
        .rejects
        .toThrow('User not found')
    })

    it('should prevent removing role from last admin user', async () => {
      // Try to remove admin role from the admin created in beforeEach
      await expect(UserService.changeUserRole(adminUser.id, 'USER'))
        .rejects
        .toThrow('Cannot remove admin role from the last active admin user')
    })

    it('should allow changing role when other admins exist', async () => {
      // Create another admin user
      const anotherAdmin = await prisma.user.create({
        data: {
          name: 'Another Admin',
          email: 'another@test.com',
          password: 'password123',
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      })

      // Should be able to change role of original admin when another exists
      const updatedAdmin = await UserService.changeUserRole(adminUser.id, 'USER')
      expect(updatedAdmin.role).toBe('USER')

      // Other admin should still be admin
      const otherAdmin = await UserService.getUserById(anotherAdmin.id)
      expect(otherAdmin.role).toBe('ADMIN')
    })
  })

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            name: 'Manager User',
            email: 'manager@test.com',
            password: 'password123',
            role: 'MANAGER',
            status: 'ACTIVE'
          },
          {
            name: 'Regular User 1',
            email: 'user1@test.com',
            password: 'password123',
            role: 'USER',
            status: 'ACTIVE'
          },
          {
            name: 'Regular User 2',
            email: 'user2@test.com',
            password: 'price123',
            role: 'USER',
            status: 'INACTIVE'
          }
        ]
      })

      const stats = await UserService.getUserStatistics()
      // Should include admin from beforeEach plus 3 created users
      expect(stats.total).toBe(4)
      expect(stats.active).toBe(3) // admin + manager + active user
      expect(stats.inactive).toBe(1) // inactive user
      expect(stats.byRole.admin).toBe(1) // admin from beforeEach
      expect(stats.byRole.manager).toBe(1) // manager user
      expect(stats.byRole.user).toBe(2) // two regular users
    })

    it('should return zero statistics when no users exist', async () => {
      // First delete the admin user created in beforeEach to test true zero state
      await prisma.user.delete({ where: { id: adminUser.id } })

      const stats = await UserService.getUserStatistics()
      expect(stats.total).toBe(0)
      expect(stats.active).toBe(0)
      expect(stats.inactive).toBe(0)
      expect(stats.byRole.admin).toBe(0)
      expect(stats.byRole.manager).toBe(0)
      expect(stats.byRole.user).toBe(0)
    })
  })
})