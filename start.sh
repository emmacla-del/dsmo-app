#!/bin/bash

echo "🚀 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database (optional)..."
node prisma/seed.js || echo "⚠️ Seed skipped"

echo "🚀 Starting NestJS server..."
exec node dist/main.js