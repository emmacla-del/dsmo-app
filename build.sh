#!/bin/bash
set -e

echo "🌐 Installing Google Chrome for PDF generation..."
apt-get update -y
apt-get install -y google-chrome-stable

echo "📦 Installing dependencies..."
npm install --include=dev

echo "⚙️ Generating Prisma client..."
npx prisma generate

echo "🚀 Running database migrations..."
npx prisma migrate deploy

echo "🔨 Building NestJS..."
npm run build

echo "✅ Build complete."