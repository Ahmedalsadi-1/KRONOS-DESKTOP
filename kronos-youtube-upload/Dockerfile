FROM python:3.14-slim

# Install system dependencies for Google API authentication
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY youtube-upload/ .

RUN pip install --no-cache-dir -e .

# Create necessary directories for auth and data
RUN mkdir -p /app/data /app/.oauth2

# Set environment variables
ENV PYTHONPATH=/app
ENV OAUTHLIB_INSECURE_TRANSPORT=1

# Default command
CMD ["python", "-c", "print('YouTube Upload container ready - run specific commands as needed')"]
