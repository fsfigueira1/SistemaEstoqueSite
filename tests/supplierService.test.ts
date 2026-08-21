import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { SupplierService } from '../src/services/supplierService';
import { ProductService } from '../src/services/productService';
import { PurchaseService } from '../src/services/purchaseService';
import { prisma } from './setup';
import { Prisma } from '../src/lib/prisma';
import { cleanupDatabase, createAdminUser } from './utils';

describe('Supplier Service', () => {
  let adminUser: Prisma.UserModel;
  let testCategory: Prisma.CategoryModel;
  let testProduct: Prisma.ProductModel;

  beforeEach(async () => {
    await cleanupDatabase();
    adminUser = await createAdminUser();

    // Create a category for our test product
    testCategory = await prisma.category.create({
      data: {
        name: 'Test Category',
        id: '11111111-1111-1111-1111-111111111111'
      }
    });

    // Create a test product
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product',
        sku: 'TEST001',
        categoryId: testCategory.id,
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 100,
        status: 'ACTIVE'
      }
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('createSupplier', () => {
    it('should create a valid supplier', async () => {
      const supplierData = {
        name: 'TechSupply Inc.',
        contactName: 'John Smith',
        email: 'john@techsupplier.com',
        phone: '(11) 99999-9999',
        address: 'Tech Avenue, 123'
      };

      const supplier = await SupplierService.createSupplier(supplierData);

      expect(supplier).toBeDefined();
      expect(supplier.id).toBeDefined();
      expect(supplier.name).toBe('TechSupply Inc.');
      expect(supplier.contactName).toBe('John Smith');
      expect(supplier.email).toBe('john@techsupplier.com');
      expect(supplier.phone).toBe('(11) 99999-9999');
      expect(supplier.address).toBe('Tech Avenue, 123');
    });

    it('should throw error for missing name', async () => {
      await expect(
        SupplierService.createSupplier({
          name: ''
        })
      ).rejects.toThrow('Supplier name is required');
    });

    it('should throw error for duplicate name', async () => {
      // Create first supplier
      await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      // Try to create second supplier with same name
      await expect(
        SupplierService.createSupplier({
          name: 'TechSupply Inc.'
        })
      ).rejects.toThrow('Supplier with this name already exists');
    });
  });

  describe('getSupplierById', () => {
    it('should return supplier by valid ID', async () => {
      const supplierData = {
        name: 'TechSupply Inc.'
      };

      const createdSupplier = await SupplierService.createSupplier(supplierData);
      const supplier = await SupplierService.getSupplierById(createdSupplier.id);

      expect(supplier).toBeDefined();
      expect(supplier.id).toBe(createdSupplier.id);
      expect(supplier.name).toBe('TechSupply Inc.');
    });

    it('should throw error for non-existent supplier ID', async () => {
      await expect(
        SupplierService.getSupplierById('non-existent-id')
      ).rejects.toThrow('Supplier not found');
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier fields correctly', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.',
        contactName: 'John Smith',
        email: 'john@techsupplier.com',
        phone: '(11) 99999-9999',
        address: 'Tech Avenue, 123'
      });

      const updatedSupplier = await SupplierService.updateSupplier(supplier.id, {
        name: 'Global Tech Suppliers',
        contactName: 'Jane Doe',
        email: 'jane@globaltech.com',
        phone: '(21) 88888-8888',
        address: 'Global Blvd, 456'
      });

      expect(updatedSupplier.name).toBe('Global Tech Suppliers');
      expect(updatedSupplier.contactName).toBe('Jane Doe');
      expect(updatedSupplier.email).toBe('jane@globaltech.com');
      expect(updatedSupplier.phone).toBe('(21) 88888-8888');
      expect(updatedSupplier.address).toBe('Global Blvd, 456');
    });

    it('should throw error when updating to duplicate name', async () => {
      // Create two suppliers
      const supplier1 = await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      const supplier2 = await SupplierService.createSupplier({
        name: 'Global Supplies'
      });

      // Try to update supplier2 to have supplier1's name
      await expect(
        SupplierService.updateSupplier(supplier2.id, {
          name: 'TechSupply Inc.'
        })
      ).rejects.toThrow('Supplier with this name already exists');
    });

    it('should allow setting contactName to null', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.',
        contactName: 'John Smith'
      });

      const updatedSupplier = await SupplierService.updateSupplier(supplier.id, {
        contactName: null
      });

      expect(updatedSupplier.contactName).toBeNull();
    });

    it('should allow setting email to null', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.',
        email: 'john@techsupplier.com'
      });

      const updatedSupplier = await SupplierService.updateSupplier(supplier.id, {
        email: null
      });

      expect(updatedSupplier.email).toBeNull();
    });

    it('should allow setting phone to null', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.',
        phone: '(11) 99999-9999'
      });

      const updatedSupplier = await SupplierService.updateSupplier(supplier.id, {
        phone: null
      });

      expect(updatedSupplier.phone).toBeNull();
    });

    it('should allow setting address to null', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.',
        address: 'Tech Avenue, 123'
      });

      const updatedSupplier = await SupplierService.updateSupplier(supplier.id, {
        address: null
      });

      expect(updatedSupplier.address).toBeNull();
    });
  });

  describe('deleteSupplier', () => {
    it('should delete supplier without dependencies', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      await SupplierService.deleteSupplier(supplier.id);

      // Verify supplier is deleted
      await expect(
        SupplierService.getSupplierById(supplier.id)
      ).rejects.toThrow('Supplier not found');
    });

    it('should prevent deletion of supplier with associated products', async () => {
      // Create supplier
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      // Create a product associated with the supplier
      await ProductService.createProduct({
        name: 'Electronic Component',
        sku: 'COMP001',
        categoryId: testCategory.id,
        supplierId: supplier.id,
        costPrice: 5.0,
        salePrice: 10.0,
        stockQuantity: 100
      });

      // Try to delete supplier - should fail
      await expect(
        SupplierService.deleteSupplier(supplier.id)
      ).rejects.toThrow(/Cannot delete supplier because \d+ record\(s\) are associated with this supplier/);
    });

    it('should prevent deletion of supplier with associated purchase orders', async () => {
      // Create supplier
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      // Create a purchase order associated with the supplier
      await PurchaseService.createPurchaseOrder({
        supplierId: supplier.id,
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // One week from now
        notes: 'Test purchase order',
        createdById: adminUser.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 5,
            unitPrice: 10.0
          }
        ]
      });

      // Try to delete supplier - should fail
      await expect(
        SupplierService.deleteSupplier(supplier.id)
      ).rejects.toThrow(/Cannot delete supplier because \d+ record\(s\) are associated with this supplier/);
    });

    it('should allow deletion after removing associated dependencies', async () => {
      // Create supplier
      const supplier = await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      // Create a dependent product
      await ProductService.createProduct({
        name: 'Test Product',
        sku: 'DEPENDENT001',
        categoryId: testCategory.id,
        supplierId: supplier.id,
        costPrice: 10.0,
        salePrice: 15.0,
        stockQuantity: 5
      });

      // Create another supplier without dependencies
      const supplier2 = await SupplierService.createSupplier({
        name: 'Another Supplier'
      });

      // Verify we can delete supplier2 (no dependencies)
      await SupplierService.deleteSupplier(supplier2.id);

      // Verify supplier2 is deleted
      await expect(
        SupplierService.getSupplierById(supplier2.id)
      ).rejects.toThrow('Supplier not found');
    });
  });

  describe('getSuppliers', () => {
    it('should return all suppliers when no filters applied', async () => {
      await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      await SupplierService.createSupplier({
        name: 'Global Supplies'
      });

      const result = await SupplierService.getSuppliers({});
      expect(result.suppliers).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter suppliers by name', async () => {
      await SupplierService.createSupplier({
        name: 'TechSupply Inc.'
      });

      await SupplierService.createSupplier({
        name: 'Global Supplies'
      });

      const result = await SupplierService.getSuppliers({ name: 'Tech' });
      expect(result.suppliers).toHaveLength(1);
      expect(result.suppliers[0].name).toBe('TechSupply Inc.');
    });

    it('should handle pagination correctly', async () => {
      // Create 3 suppliers
      for (let i = 1; i <= 3; i++) {
        await SupplierService.createSupplier({
          name: `Supplier ${i}`
        });
      }

      // Get first page with limit 2
      const result1 = await SupplierService.getSuppliers({ page: 1, limit: 2 });
      expect(result1.suppliers).toHaveLength(2);
      expect(result1.pagination.total).toBe(3);
      expect(result1.pagination.page).toBe(1);
      expect(result1.pagination.limit).toBe(2);
      expect(result1.pagination.totalPages).toBe(2);

      // Get second page with limit 2
      const result2 = await SupplierService.getSuppliers({ page: 2, limit: 2 });
      expect(result2.suppliers).toHaveLength(1);
      expect(result2.pagination.page).toBe(2);
    });
  });
});