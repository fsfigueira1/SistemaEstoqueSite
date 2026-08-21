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

describe('Product API Routes', () => {
  let adminUser: any;
  let regularUser: any;
  let userRoleUser: any; // USER role for testing insufficient permissions
  let testCategory: any;
  let testProduct: any;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();
    regularUser = await createTestUser(); // This creates a MANAGER user

    // Create a USER role user for testing insufficient permissions
    userRoleUser = await prisma.user.create({
      data: {
        email: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
        name: 'Regular User',
        password: 'hashed_password_123',
        role: 'USER',
        status: 'ACTIVE'
      }
    });

    // Create a test category first
    testCategory = await prisma.category.create({
      data: {
        name: 'Test Category'
      }
    });

    // Create a test product
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'TEST001',
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 100,
        status: 'ACTIVE',
        categoryId: testCategory.id
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  // Import the API route handlers dynamically to avoid SSR issues
  const getProductApiModule = async () => {
    const module = await import('@/app/api/products/route');
    return module;
  };

  const getProductByIdApiModule = async () => {
    const module = await import('@/app/api/products/[id]/route');
    return module;
  };

  describe('GET /api/products - List products', () => {
    it('should return success with product list for authenticated admin', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getProductApiModule();
      const request = new MockRequest('http://localhost:3000/api/products?page=1&limit=10', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.products)).toBe(true);
      expect(json.data.products.length).toBeGreaterThan(0);
    });

    it('should return unauthorized for unauthenticated request', async () => {
      // Set current auth user for mock (null = unauthenticated)
      currentAuthUser = null;

      const { GET } = await getProductApiModule();
      const request = new MockRequest('http://localhost:3000/api/products', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should return forbidden for user with insufficient role', async () => {
      // Set current auth user for mock (USER role - insufficient for product listing)
      currentAuthUser = userRoleUser;

      const { GET } = await getProductApiModule();
      const request = new MockRequest('http://localhost:3000/api/products?page=1&limit=10', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should handle pagination correctly', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getProductApiModule();
      const request = new MockRequest('http://localhost:3000/api/products?page=1&limit=5', 'GET');

      const response = await GET(request as any);
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      // Pagination data is nested in data.pagination
      expect(json.data.pagination.limit).toBe(5);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/products/[id] - Get product by ID', () => {
    it('should return success with product data for valid ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getProductByIdApiModule();
      const request = new MockRequest(`http://localhost:3000/api/products/${testProduct.id}`, 'GET');

      const response = await GET(request as any, { params: { id: testProduct.id } });
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(testProduct.id);
      expect(json.data.name).toBe(testProduct.name);
      expect(json.data.sku).toBe(testProduct.sku);
    });

    it('should return not found for invalid product ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { GET } = await getProductByIdApiModule();
      const request = new MockRequest('http://localhost:3000/api/products/non-existent-id', 'GET');

      const response = await GET(request as any, { params: { id: 'non-existent-id' } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/products - Create product', () => {
    it('should return success with created product for valid data', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { POST } = await getProductApiModule();
      const productData = {
        name: 'New Test Product',
        sku: 'NEW001',
        costPrice: 20.0,
        salePrice: 25.0,
        stockQuantity: 50,
        status: 'ACTIVE',
        categoryId: testCategory.id
      };
      const request = new MockRequest('http://localhost:3000/api/products', 'POST', productData);

      const response = await POST(request as any);
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe(productData.name);
      expect(json.data.sku).toBe(productData.sku);
      expect(json.data.id).toBeDefined();
    });

    it('should return validation error for missing required fields', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { POST } = await getProductApiModule();
      const incompleteData = {
        name: 'Incomplete Product'
        // Missing sku, costPrice, salePrice, categoryId
      };
      const request = new MockRequest('http://localhost:3000/api/products', 'POST', incompleteData);

      const response = await POST(request as any);
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return conflict error for duplicate SKU', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { POST } = await getProductApiModule();
      const duplicateData = {
        name: 'Duplicate Product',
        sku: testProduct.sku, // Same SKU as existing product
        costPrice: 12.0,
        salePrice: 18.0,
        stockQuantity: 30,
        status: 'ACTIVE',
        categoryId: testCategory.id
      };
      const request = new MockRequest('http://localhost:3000/api/products', 'POST', duplicateData);

      const response = await POST(request as any);
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });
  });

  describe('PUT /api/products/[id] - Update product', () => {
    it('should return success with updated product for valid data', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { PUT } = await getProductByIdApiModule();
      const updateData = {
        name: 'Updated Product Name',
        salePrice: 18.0
      };
      const request = new MockRequest(`http://localhost:3000/api/products/${testProduct.id}`, 'PUT', updateData);

      const response = await PUT(request as any, { params: { id: testProduct.id } });
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe(updateData.name);
      expect(json.data.salePrice).toBe(updateData.salePrice);
      expect(json.data.id).toBe(testProduct.id);
    });

    it('should return not found for non-existent product ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { PUT } = await getProductByIdApiModule();
      const updateData = { name: 'Updated Product' };
      const request = new MockRequest('http://localhost:3000/api/products/non-existent-id', 'PUT', updateData);

      const response = await PUT(request as any, { params: { id: 'non-existent-id' } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/products/[id] - Deactivate product', () => {
    it('should return success for valid product ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { DELETE } = await getProductByIdApiModule();
      const request = new MockRequest(`http://localhost:3000/api/products/${testProduct.id}`, 'DELETE');

      const response = await DELETE(request as any, { params: { id: testProduct.id } });
      const json = await response.json() as { success: boolean; data: any };

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deactivated).toBe(true);
    });

    it('should return forbidden for user without admin role', async () => {
      // Set current auth user for mock
      currentAuthUser = regularUser;

      const { DELETE } = await getProductByIdApiModule();
      const request = new MockRequest(`http://localhost:3000/api/products/${testProduct.id}`, 'DELETE');

      const response = await DELETE(request as any, { params: { id: testProduct.id } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should return not found for non-existent product ID', async () => {
      // Set current auth user for mock
      currentAuthUser = adminUser;

      const { DELETE } = await getProductByIdApiModule();
      const request = new MockRequest('http://localhost:3000/api/products/non-existent-id', 'DELETE');

      const response = await DELETE(request as any, { params: { id: 'non-existent-id' } });
      const json = await response.json() as { success: boolean; error: any };

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});