# Laçolaria ERP

A professional ERP system for stationery stores, built with Next.js 15, React 19, TypeScript, and a modern tech stack.

## Overview

Laçolaria ERP is a comprehensive enterprise resource planning system designed specifically for stationery and paper stores. It includes modules for product management, inventory control, sales, purchasing, customer management, and financial reporting.

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React features
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible UI components
- **Lucide React** - Modern icon set
- **Framer Motion** - Animation library

### Backend
- **Next.js Route Handlers** - Serverless API functions
- **Prisma ORM** - TypeScript-first ORM
- **PostgreSQL** - Relational database (Supabase for development)
- **Auth.js (NextAuth)** - Authentication solution

### Additional Libraries
- **Zod** - Schema validation
- **React Hook Form** - Form management
- **TanStack Table** - Data tables
- **Recharts** - Data visualization
- **Sonner** - Toast notifications
- **Cloudinary** - File uploads
- **QuaggaJS** - Barcode scanning
- **qrcode** - QR code generation
- **Pino** - Logging
- **date-fns** - Date formatting

## Project Structure

```
src/
├── app/                  # Next.js App Router
├── components/           # Reusable UI components
├── components/ui/        # shadcn/ui components
├── modules/              # Feature modules
├── services/             # Business logic services
├── repositories/         # Data access layer
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and helpers
├── types/                # TypeScript type definitions
├── schemas/              # Validation schemas (Zod)
├── prisma/               # Prisma ORM configuration and migrations
├── public/               # Static assets
�└── docs/                 # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn
- PostgreSQL database (or Supabase account for development)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in the required values:
   ```env
   # Supabase PostgreSQL Connection
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres"

   # NextAuth Configuration
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"

   # Cloudinary Configuration
   CLOUDINARY_NAME="your-cloudinary-name"
   CLOUDINARY_API_KEY="your-cloudinary-api-key"
   CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
   ```

4. Initialize the database:
   ```bash
   npx prisma migrate dev --name init
   ```

5. Seed the database with sample data (optional):
   ```bash
   npm run seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma database GUI
- `npm run seed` - Seed database with sample data

## Features

### Authentication
- Secure login with NextAuth
- Role-based access control (Admin, Manager, User, Accountant)
- Session management

### Product Management
- Complete product catalog with SKU, barcode, categories
- Inventory tracking with real-time stock updates
- Supplier management
- Product variants and bundles

### Sales & Orders
- Point of sale interface
- Order management and tracking
- Customer management
- Payment processing (cash, card, PIX, etc.)

### Purchasing
- Purchase order management
- Supplier management
- Goods receiving

### Reporting & Analytics
- Sales reports
- Inventory reports
- Financial summaries
- Data visualization with charts

### Additional Features
- Barcode scanning with QuaggaJS
- QR code generation
- File uploads with Cloudinary
- Audit trail for all important actions
- Responsive design (desktop-first)
- Professional, modern UI inspired by Stripe and Vercel dashboards

## Database Schema

The ERP includes the following main entities:
- **User** - System users with roles and permissions
- **Product** - Items for sale with inventory tracking
- **Category** - Product categorization
- **Supplier** - Vendors and manufacturers
- **Customer** - Buyers and clients
- **Order** - Sales transactions
- **PurchaseOrder** - Purchases from suppliers
- **StockMovement** - Inventory audit trail
- **And more...**

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

- Inspired by modern ERP systems and SaaS platforms
- Built with the awesome Next.js and React ecosystem
- Component library powered by shadcn/ui
- Icons by Lucide
