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
./node_modules/.bin/prisma generate

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
./node_modules/.bin/prisma migrate deploy

# Start the server
echo "✅ Build complete! Starting server..."
npm run start:prod