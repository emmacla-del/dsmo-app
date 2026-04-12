#!/bin/bash

echo "🚀 Starting build process..."
echo "Current directory: $(pwd)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client using the standard command
echo "🗄️  Generating Prisma client..."
npx prisma generate

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Check if dist folder was created
echo "📁 Checking build output:"
if [ -d "dist" ]; then
    echo "✅ dist folder exists"
    ls -la dist/
else
    echo "❌ dist folder not found!"
    exit 1
fi

# Run database migrations using Prisma
echo "📋 Running database migrations..."
npx prisma migrate deploy

# Run the seed using compiled JavaScript (no ts-node)
echo "🌱 Seeding database..."
node prisma/seed.js || echo "⚠️ Seed skipped"

echo "✅ Build complete!"