/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- teste: dados montados à mão e resultados que o próprio teste garante */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prisma } from './setup';
import { cleanupDatabase, createAdminUser, createTestUser } from './utils';

// Mock the request object for testing
class MockRequest {
  constructor(public url: string, public method: string = 'GET', public body: any = null) {}

  json() {
    return Promise.resolve(this.body);
  }
}

// We'll set up the mock in each test since we need access to test-specific variables
let currentAuthUser: any = null;

// Mock NextAuth session - will be updated in each test
vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(currentAuthUser ? {
    user: {
      id: currentAuthUser.id,
      name: currentAuthUser.name,
      email: currentAuthUser.email,
      role: currentAuthUser.role
    }
  } : null)
}));

describe('Category API Routes', () => {
  let adminUser: any;
  let testCategory: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();
    await createTestUser(); // This creates a MANAGER user

    // Create a USER role user for testing insufficient permissions
    await prisma.user.create({
      data: {
        email: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
        name: 'Regular User',
        password: 'hashed_password_123',
        role: 'USER',
        status: 'ACTIVE'
      }
    });

    // Create a test category
    testCategory = await prisma.category.create({
      data: {
        name: 'Test Category',
        description: 'Test Description',
        icon: 'TestIcon',
        color: '#FF0000'
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  // Import the API route handlers dynamically to avoid SSR issues
  const getCategoryApiModule = async () => {
    const module = await import('@/app/api/categories/route');
    return module;
  };

  const getCategoryByIdApiModule = async () => {
    const module = await import('@/app/api/categories/[id]/route');
    return module;
  };

  describe('GET /api/categories - List categories', () => {
    it('should return success with category list for authenticated admin', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getCategoryApiModule();
      const request = new MockRequest('http://localhost:3000/api/categories?page=1&limit=10', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; data: any; error?: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.categories)).toBe(true);
      expect(json.data.categories.length).toBeGreaterThan(0);
    });

    // Quem barra é o src/proxy.ts (crachá assinado + perfil); os casos
    // completos estão em tests/proxy.test.ts.
    it('should return unauthorized for unauthenticated request (proxy do login)', async () => {
      const { proxy } = await import('@/proxy');
      const { NextRequest } = await import('next/server');
      expect((await proxy(new NextRequest('http://localhost:3000/api/categories'))).status).toBe(401);
      // cookie antigo do PIN não vale mais
      expect((await proxy(new NextRequest('http://localhost:3000/api/categories', { headers: { cookie: 'erp_auth=OWNER:1' } }))).status).toBe(401);
    });

    it('should return forbidden for user with insufficient role (balcão não cria categoria)', async () => {
      const { proxy } = await import('@/proxy');
      const { NextRequest } = await import('next/server');
      const { signToken } = await import('@/lib/authToken');
      const { sessionKey } = await import('@/lib/authStamp');
      const cookie = `erp_auth=${await signToken(await sessionKey('EMPLOYEE'), 'EMPLOYEE', Date.now() + 60_000)}`;
      expect((await proxy(new NextRequest('http://localhost:3000/api/categories', { headers: { cookie } }))).status).toBe(200);
      expect((await proxy(new NextRequest('http://localhost:3000/api/categories', { method: 'POST', headers: { cookie } }))).status).toBe(403);
    });

    it('should handle pagination correctly', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getCategoryApiModule();
      const request = new MockRequest('http://localhost:3000/api/categories?page=1&limit=5', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      // Pagination data is nested in data.pagination
      expect(json.data.pagination.limit).toBe(5);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should filter categories by name', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getCategoryApiModule();
      const request = new MockRequest('http://localhost:3000/api/categories?name=Test&page=1&limit=10', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.categories.length).toBeGreaterThan(0);
      expect(json.data.categories[0].name).toContain('Test');
    });
  });

  describe('GET /api/categories/[id] - Get category by ID', () => {
    it('should return success with category data for valid ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getCategoryByIdApiModule();
      const request = new MockRequest(`http://localhost:3000/api/categories/${testCategory.id}`, 'GET');

      const response = await GET(request as any, { params: { id: testCategory.id } });
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(testCategory.id);
      expect(json.data.name).toBe(testCategory.name);
      expect(json.data.description).toBe(testCategory.description);
    });

    it('should return not found for invalid category ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getCategoryByIdApiModule();
      const request = new MockRequest('http://localhost:3000/api/categories/non-existent-id', 'GET');

      const response = await GET(request as any, { params: { id: 'non-existent-id' } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/categories - Create category', () => {
    it('should return success with created category for valid data', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { POST } = await getCategoryApiModule();
      const categoryData = {
        name: 'New Test Category',
        description: 'New Test Description',
        icon: 'NewIcon',
        color: '#00FF00'
      };
      const request = new MockRequest('http://localhost:3000/api/categories', 'POST', categoryData);

      const response = await POST(request as any);
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe(categoryData.name);
      expect(json.data.description).toBe(categoryData.description);
      expect(json.data.id).toBeDefined();
    });

    it('should return validation error for missing required fields', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { POST } = await getCategoryApiModule();
      const incompleteData = {
        description: 'Test Description'
        // Missing name
      };
      const request = new MockRequest('http://localhost:3000/api/categories', 'POST', incompleteData);

      const response = await POST(request as any);
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return conflict error for duplicate name', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { POST } = await getCategoryApiModule();
      const duplicateData = {
        name: testCategory.name, // Same name as existing category
        description: 'Duplicate Category Description',
        icon: 'DuplicateIcon',
        color: '#0000FF'
      };
      const request = new MockRequest('http://localhost:3000/api/categories', 'POST', duplicateData);

      const response = await POST(request as any);
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });
  });

  describe('PUT /api/categories/[id] - Update category', () => {
    it('should return success with updated category for valid data', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { PUT } = await getCategoryByIdApiModule();
      const updateData = {
        name: 'Updated Category Name',
        description: 'Updated Description'
      };
      const request = new MockRequest(`http://localhost:3000/api/categories/${testCategory.id}`, 'PUT', updateData);

      const response = await PUT(request as any, { params: { id: testCategory.id } });
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe(updateData.name);
      expect(json.data.description).toBe(updateData.description);
      expect(json.data.id).toBe(testCategory.id);
    });

    it('should return not found for non-existent category ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { PUT } = await getCategoryByIdApiModule();
      const updateData = { name: 'Updated Category' };
      const request = new MockRequest('http://localhost:3000/api/categories/non-existent-id', 'PUT', updateData);

      const response = await PUT(request as any, { params: { id: 'non-existent-id' } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should return conflict error when updating to duplicate name', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      // Create a second category
      const category2 = await prisma.category.create({
        data: {
          name: 'Second Category',
          description: 'Second Description',
          icon: 'SecondIcon',
          color: '#FFFF00'
        }
      });

      const { PUT } = await getCategoryByIdApiModule();
      const updateData = {
        name: category2.name // Try to update first category to have second category's name
      };
      const request = new MockRequest(`http://localhost:3000/api/categories/${testCategory.id}`, 'PUT', updateData);

      const response = await PUT(request as any, { params: { id: testCategory.id } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });
  });

  describe('DELETE /api/categories/[id] - Delete category', () => {
    it('should return success for valid category ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { DELETE } = await getCategoryByIdApiModule();
      const request = new MockRequest(`http://localhost:3000/api/categories/${testCategory.id}`, 'DELETE');

      const response = await DELETE(request as any, { params: { id: testCategory.id } });
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
    });

    it('should return forbidden for user without admin role (balcão não apaga categoria)', async () => {
      const { proxy } = await import('@/proxy');
      const { NextRequest } = await import('next/server');
      const { signToken } = await import('@/lib/authToken');
      const { sessionKey } = await import('@/lib/authStamp');
      const cookie = `erp_auth=${await signToken(await sessionKey('EMPLOYEE'), 'EMPLOYEE', Date.now() + 60_000)}`;
      expect((await proxy(new NextRequest('http://localhost:3000/api/categories/abc', { method: 'DELETE', headers: { cookie } }))).status).toBe(403);
    });

    it('should return not found for non-existent category ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { DELETE } = await getCategoryByIdApiModule();
      const request = new MockRequest('http://localhost:3000/api/categories/non-existent-id', 'DELETE');

      const response = await DELETE(request as any, { params: { id: 'non-existent-id' } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});