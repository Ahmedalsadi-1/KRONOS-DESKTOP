FROM python:3.14-slim

# Install system dependencies for video processing (moviepy/ffmpeg)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY instagrapi/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/data /app/downloads

# Set environment variables
ENV PYTHONPATH=/app

# Default command
CMD ["python", "-c", "print('Instagrapi container ready - run specific commands as needed')"]
