#!/bin/bash
set -e

echo "📦 Installing dependencies..."
npm install --include=dev

echo "⚙️ Generating Prisma client..."
npx prisma generate

echo "🚀 Running database migrations..."
npx prisma migrate deploy

echo "🔨 Building NestJS..."
npm run build

echo "🌐 Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

echo "✅ Build complete."