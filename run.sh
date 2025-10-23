#!/bin/bash

# Quote Analytics Dashboard - Run Script
# This script starts the development server for the Quote Analytics Dashboard

echo "🚀 Starting Quote Analytics Dashboard..."
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the development server
echo "✨ Launching development server at http://localhost:5173"
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
