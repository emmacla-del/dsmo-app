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

echo "📄 Setting up WeasyPrint..."
if ! command -v weasyprint &> /dev/null; then
  echo "Installing WeasyPrint package..."
  (sudo apt-get update && sudo apt-get install -y weasyprint) || pip install weasyprint || true
fi

echo "✅ Build complete."