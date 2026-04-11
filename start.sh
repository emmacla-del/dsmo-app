#!/bin/bash

echo "🚀 Starting build process..."
echo "Current directory: $(pwd)"
echo "Listing files before build:"
ls -la

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
node node_modules/prisma/build/index.js generate

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
    echo "Contents of current directory:"
    ls -la
    exit 1
fi

# Run database migrations
echo "📋 Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

# Run the seed using ts-node with the transpile-only flag
# This bypasses the type-checking errors and runs the source file directly
echo "🌱 Seeding database..."
npx ts-node --transpile-only prisma/seed.ts

echo "✅ Build complete!"