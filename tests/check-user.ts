import { prisma } from './setup';
import { Role, UserStatus } from '../src/generated/prisma/enums';

async function check() {
  // Try to find one user to see its structure
  try {
    const user = await prisma.user.findFirst();
    if (user) {
      console.log('User structure:', Object.keys(user));
    } else {
      console.log('No users found');

      // Let's try to create one with just the basic fields to see what works
      try {
        const testUser = await prisma.user.create({
          data: {
            email: 'test@example.com',
            name: 'Test User',
            password: 'hashed_password_123',
            role: Role.USER
          }
        });
        console.log('Successfully created user with basic fields:', testUser);
      } catch (createError) {
        console.error('Error creating user with basic fields:', (createError as Error).message);

        // Try with email, name, and password (based on error messages)
        try {
          const testUser2 = await prisma.user.create({
            data: {
              email: 'test@example.com',
              name: 'Test User',
              password: 'hashed_password_123',
              role: Role.USER
            }
          });
          console.log('Successfully created user with email, name, and password:', testUser2);
        } catch (createError2) {
          console.error('Error creating user with email, name, and password:', (createError2 as Error).message);
        }

        // Try adding some extra fields
        try {
          const testUser3 = await prisma.user.create({
            data: {
              email: 'test2@example.com',
              name: 'Test User 2',
              password: 'hashed_password_456',
              role: Role.ADMIN,
              status: UserStatus.ACTIVE
            }
          });
          console.log('Successfully created user with extra fields:', testUser3);
        } catch (createError3) {
          console.error('Error creating user with extra fields:', (createError3 as Error).message);
        }
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

check();
