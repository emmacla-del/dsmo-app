#!/bin/bash
set -e

echo "📦 Installing dependencies (including dev for build)..."
npm install --include=dev

echo "⚙️ Generating Prisma client..."
npx prisma generate

echo "🚀 Running database migrations..."
npx prisma migrate deploy

echo "🔨 Building NestJS..."
npm run build

echo "🌱 Seeding database (optional)..."
node prisma/seed.js || echo "⚠️ Seed skipped"

echo "✅ Build complete."