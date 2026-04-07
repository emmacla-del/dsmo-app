#!/bin/bash

echo "🚀 Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
./node_modules/.bin/prisma generate

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Run database migrations
echo "📋 Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Start the server
echo "✅ Build complete! Starting server..."
npm run start:prod
