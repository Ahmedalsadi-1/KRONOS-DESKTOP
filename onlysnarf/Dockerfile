FROM python:3.14-slim

# Install system dependencies for Selenium and ffmpeg
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    ffmpeg \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome (skip on ARM64)
RUN ARCH=$(uname -m) && if [ "$ARCH" != "aarch64" ]; then \
        wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome-keyring.gpg \
        && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
        && apt-get update \
        && apt-get install -y google-chrome-stable \
        && rm -rf /var/lib/apt/lists/*; \
    fi

# Install ChromeDriver (skip on ARM64)
RUN ARCH=$(uname -m) && if [ "$ARCH" != "aarch64" ]; then \
        CHROMEDRIVER_VERSION=$(curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE) \
        && wget -q -O /tmp/chromedriver.zip http://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip \
        && unzip /tmp/chromedriver.zip -d /usr/local/bin/ \
        && chmod +x /usr/local/bin/chromedriver \
        && rm /tmp/chromedriver.zip; \
    fi

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY onlysnarf/ .
RUN pip install --no-cache-dir -e .

# Create necessary directories
RUN mkdir -p /app/downloads /root/.onlysnarf/users

# Set environment variables
ENV PYTHONPATH=/app
ENV PATH="/usr/local/bin:${PATH}"

# Expose Flask port
EXPOSE 5000

# Default command (can be overridden)
CMD ["python", "-c", "print('OnlySnarf container ready - run specific commands as needed')"]
