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

echo "📋 Copying PDF templates..."
mkdir -p dist/pdf/templates/dynamic
cp -r src/pdf/templates/dynamic/. dist/pdf/templates/dynamic/

echo "✅ Templates present:"
find dist/pdf/templates -type f -name "*.hbs"

echo "🌐 Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

echo "✅ Build complete."