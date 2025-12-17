FROM python:3.14-slim

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY pytube/ .

# Try Pipfile first, fallback to setup.py
RUN pip install --no-cache-dir pipenv && pipenv install --dev --system --deploy || pip install --no-cache-dir -e .

# Create necessary directories
RUN mkdir -p /app/downloads

# Set environment variables
ENV PYTHONPATH=/app

# Default command
CMD ["python", "-c", "print('PyTube container ready - run specific commands as needed')"]
