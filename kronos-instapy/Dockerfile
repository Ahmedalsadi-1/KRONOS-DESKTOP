FROM python:3.14-slim

# Install system dependencies for Selenium and browser automation
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    gnupg \
    firefox-esr \
    && rm -rf /var/lib/apt/lists/*

# Install GeckoDriver for Firefox
RUN GECKODRIVER_VERSION=$(curl -sS https://api.github.com/repos/mozilla/geckodriver/releases/latest | grep tag_name | cut -d '"' -f 4) \
    && ARCH=$(uname -m) \
    && if [ "$ARCH" = "aarch64" ]; then \
        wget -q -O /tmp/geckodriver.tar.gz https://github.com/mozilla/geckodriver/releases/download/${GECKODRIVER_VERSION}/geckodriver-${GECKODRIVER_VERSION}-linux-aarch64.tar.gz; \
    else \
        wget -q -O /tmp/geckodriver.tar.gz https://github.com/mozilla/geckodriver/releases/download/${GECKODRIVER_VERSION}/geckodriver-${GECKODRIVER_VERSION}-linux64.tar.gz; \
    fi \
    && tar -xzf /tmp/geckodriver.tar.gz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/geckodriver \
    && rm /tmp/geckodriver.tar.gz

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY InstaPy/ .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -e .

# Create necessary directories
RUN mkdir -p /app/data /app/logs

# Set environment variables
ENV PYTHONPATH=/app
ENV PATH="/usr/local/bin:${PATH}"

# Default command (can be overridden)
CMD ["python", "-c", "print('InstaPy container ready - run specific commands as needed')"]
