#!/bin/bash
set -e  # ← stop on any error so you see exactly what failed

echo "📦 Installing dependencies..."
npm install

echo "⚙️ Generating Prisma client..."
npx prisma generate

echo "🚀 Running database migrations..."
npx prisma migrate deploy

echo "🔨 Building NestJS..."
npm run build

echo "🌱 Seeding database (optional)..."
node prisma/seed.js || echo "⚠️ Seed skipped"

echo "✅ Build complete."