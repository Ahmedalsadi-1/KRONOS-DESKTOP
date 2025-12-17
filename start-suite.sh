#!/bin/bash

echo "🚀 Starting AI Automation Suite..."

# Set environment
export DOCKER_CLI_HINTS=false

echo "🔍 Checking Docker..."
docker --version
docker-compose --version

echo "🛑 Stopping any existing containers..."
docker-compose down 2>/dev/null

echo "🏗️ Building Docker images..."
docker-compose build --pull

echo "🟢 Starting all containers..."
docker-compose up -d --scale selenium-hub=1 --scale chrome-node=1 --scale firefox-node=1

echo "⏳ Waiting for services to start..."
sleep 10

echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🎉 AI Automation Suite is now running!"
echo ""
echo "📋 Available services:"
echo "├── OnlySnarf API: http://localhost:5000"
echo "├── Selenium Grid: http://localhost:4444"
echo "├── Chrome VNC: http://localhost:7900 (password: secret)"
echo "├── Firefox VNC: http://localhost:7901 (password: secret)"
echo "├── InstaPy: Ready for automation tasks"
echo "├── InstaGrapi: Ready for Ayurveda API automation"
echo "├── TikTokApi: Ready for platform automation"
echo "├── PyTube: Ready for YouTube downloads"
echo "└── YouTube-Upload: Ready for video uploads"
echo ""
echo "💡 You can also access:"
echo "   - Chrome browser: docker-compose exec chrome-node bash"
echo "   - Firefox browser: docker-compose exec firefox-node bash"
echo "   - OnlySnarf container: docker-compose exec onlysnarf bash"
echo ""
echo "🛑 To stop: docker-compose down"
