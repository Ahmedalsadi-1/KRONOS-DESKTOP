FROM python:3.14-slim

# Install system dependencies for Playwright (TikTokApi uses this)
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY TikTok-Api/setup.py .
COPY TikTok-Api/README.md .

RUN pip install --no-cache-dir -e .

# Install Playwright browsers
RUN playwright install chromium
RUN playwright install-deps chromium

# Create necessary directories
RUN mkdir -p /app/data

# Set environment variables
ENV PYTHONPATH=/app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Default command
CMD ["python", "-c", "print('TikTokApi container ready - run specific commands as needed')"]
