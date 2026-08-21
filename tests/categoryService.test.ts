import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { CategoryService } from '../src/services/categoryService';
import { ProductService } from '../src/services/productService';
import { prisma } from './setup';
import { cleanupDatabase } from './utils';

describe('Category Service', () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  describe('createCategory', () => {
    it('should create a valid category', async () => {
      const categoryData = {
        name: 'Electronics',
        description: 'Electronic devices and gadgets',
        icon: 'Laptop',
        color: '#3B82F6'
      };

      const category = await CategoryService.createCategory(categoryData);

      expect(category).toBeDefined();
      expect(category.id).toBeDefined();
      expect(category.name).toBe('Electronics');
      expect(category.description).toBe('Electronic devices and gadgets');
      expect(category.icon).toBe('Laptop');
      expect(category.color).toBe('#3B82F6');
    });

    it('should throw error for missing name', async () => {
      await expect(
        CategoryService.createCategory({
          name: ''
        })
      ).rejects.toThrow('Category name is required');
    });

    it('should throw error for duplicate name', async () => {
      // Create first category
      await CategoryService.createCategory({
        name: 'Electronics'
      });

      // Try to create second category with same name
      await expect(
        CategoryService.createCategory({
          name: 'Electronics'
        })
      ).rejects.toThrow('Category with this name already exists');
    });
  });

  describe('getCategoryById', () => {
    it('should return category by valid ID', async () => {
      const categoryData = {
        name: 'Electronics'
      };

      const createdCategory = await CategoryService.createCategory(categoryData);
      const category = await CategoryService.getCategoryById(createdCategory.id);

      expect(category).toBeDefined();
      expect(category.id).toBe(createdCategory.id);
      expect(category.name).toBe('Electronics');
    });

    it('should throw error for non-existent category ID', async () => {
      await expect(
        CategoryService.getCategoryById('non-existent-id')
      ).rejects.toThrow('Category not found');
    });
  });

  describe('updateCategory', () => {
    it('should update category fields correctly', async () => {
      const category = await CategoryService.createCategory({
        name: 'Electronics',
        description: 'Electronic devices',
        icon: 'Phone',
        color: '#10B981'
      });

      const updatedCategory = await CategoryService.updateCategory(category.id, {
        name: 'Consumer Electronics',
        description: 'Home electronics and appliances',
        icon: 'TV',
        color: '#F59E0B'
      });

      expect(updatedCategory.name).toBe('Consumer Electronics');
      expect(updatedCategory.description).toBe('Home electronics and appliances');
      expect(updatedCategory.icon).toBe('TV');
      expect(updatedCategory.color).toBe('#F59E0B');
    });

    it('should throw error when updating to duplicate name', async () => {
      // Create two categories
      const category1 = await CategoryService.createCategory({
        name: 'Electronics'
      });

      const category2 = await CategoryService.createCategory({
        name: 'Clothing'
      });

      // Try to update category2 to have category1's name
      await expect(
        CategoryService.updateCategory(category2.id, {
          name: 'Electronics'
        })
      ).rejects.toThrow('Category with this name already exists');
    });

    it('should allow setting description to null', async () => {
      const category = await CategoryService.createCategory({
        name: 'Electronics',
        description: 'Electronic devices'
      });

      const updatedCategory = await CategoryService.updateCategory(category.id, {
        description: null
      });

      expect(updatedCategory.description).toBeNull();
    });

    it('should allow setting icon to null', async () => {
      const category = await CategoryService.createCategory({
        name: 'Electronics',
        icon: 'Laptop'
      });

      const updatedCategory = await CategoryService.updateCategory(category.id, {
        icon: null
      });

      expect(updatedCategory.icon).toBeNull();
    });

    it('should allow setting color to null', async () => {
      const category = await CategoryService.createCategory({
        name: 'Electronics',
        color: '#3B82F6'
      });

      const updatedCategory = await CategoryService.updateCategory(category.id, {
        color: null
      });

      expect(updatedCategory.color).toBeNull();
    });
  });

  describe('deleteCategory', () => {
    it('should delete category without dependencies', async () => {
      const category = await CategoryService.createCategory({
        name: 'Electronics'
      });

      await CategoryService.deleteCategory(category.id);

      // Verify category is deleted
      await expect(
        CategoryService.getCategoryById(category.id)
      ).rejects.toThrow('Category not found');
    });

    it('should prevent deletion of category with associated products', async () => {
      // Create category
      const category = await CategoryService.createCategory({
        name: 'Electronics'
      });

      // Create a product associated with the category
      await ProductService.createProduct({
        name: 'Smartphone',
        sku: 'PHONE001',
        categoryId: category.id,
        costPrice: 300.0,
        salePrice: 500.0,
        stockQuantity: 10
      });

      // Try to delete category - should fail
      await expect(
        CategoryService.deleteCategory(category.id)
      ).rejects.toThrow(/Cannot delete category because \d+ product\(s\) are associated with this category/);
    });

    it('should allow deletion after removing associated products', async () => {
      // Create category
      const category = await CategoryService.createCategory({
        name: 'Electronics'
      });

      // Create a product associated with the category
      await ProductService.createProduct({
        name: 'Tablet',
        sku: 'TABLET001',
        categoryId: category.id,
        costPrice: 200.0,
        salePrice: 350.0,
        stockQuantity: 5
      });

      // Create another category without dependencies
      const category2 = await CategoryService.createCategory({
        name: 'Clothing'
      });

      // Verify we can delete category2 (no dependencies)
      await CategoryService.deleteCategory(category2.id);

      // Verify category2 is deleted
      await expect(
        CategoryService.getCategoryById(category2.id)
      ).rejects.toThrow('Category not found');
    });
  });

  describe('getCategories', () => {
    it('should return all categories when no filters applied', async () => {
      await CategoryService.createCategory({
        name: 'Electronics'
      });

      await CategoryService.createCategory({
        name: 'Clothing'
      });

      const result = await CategoryService.getCategories({});
      expect(result.categories).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter categories by name', async () => {
      await CategoryService.createCategory({
        name: 'Electronics'
      });

      await CategoryService.createCategory({
        name: 'Clothing'
      });

      const result = await CategoryService.getCategories({ name: 'Electro' });
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('Electronics');
    });

    it('should handle pagination correctly', async () => {
      // Create 3 categories
      for (let i = 1; i <= 3; i++) {
        await CategoryService.createCategory({
          name: `Category ${i}`
        });
      }

      // Get first page with limit 2
      const result1 = await CategoryService.getCategories({ page: 1, limit: 2 });
      expect(result1.categories).toHaveLength(2);
      expect(result1.pagination.total).toBe(3);
      expect(result1.pagination.page).toBe(1);
      expect(result1.pagination.limit).toBe(2);
      expect(result1.pagination.totalPages).toBe(2);

      // Get second page with limit 2
      const result2 = await CategoryService.getCategories({ page: 2, limit: 2 });
      expect(result2.categories).toHaveLength(1);
      expect(result2.pagination.page).toBe(2);
    });
  });
});