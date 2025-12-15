const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const puppeteer = require('puppeteer');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs').promises;

let mainWindow;
let expressApp;
let server;
let io;
let browser;
let ocrWorker;

// Embedded AI Services
class UnifiedAIServices {
  constructor() {
    this.services = {
      computerVision: null,
      webAutomation: null,
      androidControl: null,
      textAnalysis: null
    };
  }

  async initialize() {
    console.log('Initializing Unified AI Services...');

    // Initialize Puppeteer for web automation
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.services.webAutomation = browser;
      console.log('Web automation initialized');
    } catch (error) {
      console.error('Failed to initialize web automation:', error);
    }

    // Initialize OCR worker
    try {
      ocrWorker = await createWorker('eng');
      this.services.computerVision = ocrWorker;
      console.log('Computer vision (OCR) initialized');
    } catch (error) {
      console.error('Failed to initialize OCR:', error);
    }

    console.log('All AI services initialized');
  }

  async processScreenshot(imageBuffer) {
    if (!this.services.computerVision) {
      throw new Error('Computer vision service not available');
    }

    try {
      // Convert image buffer to base64 for Tesseract
      const { data: { text } } = await ocrWorker.recognize(imageBuffer);
      return {
        text: text.trim(),
        confidence: 0.85, // Mock confidence for now
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw error;
    }
  }

  async performWebSearch(query) {
    if (!this.services.webAutomation) {
      throw new Error('Web automation service not available');
    }

    try {
      const page = await browser.newPage();
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);

      // Extract search results
      const results = await page.evaluate(() => {
        const resultElements = document.querySelectorAll('h3');
        const results = [];

        for (let i = 0; i < Math.min(5, resultElements.length); i++) {
          const title = resultElements[i]?.textContent || '';
          const link = resultElements[i]?.closest('a')?.href || '';
          if (title && link) {
            results.push({ title, link });
          }
        }

        return results;
      });

      await page.close();

      return {
        query,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Web search failed:', error);
      throw error;
    }
  }

  async analyzeImage(imageBuffer) {
    // Mock image analysis - in a real implementation, this would use
    // computer vision models to analyze the image content
    return {
      description: "This appears to be a screenshot or image. Advanced AI analysis would provide detailed descriptions, object detection, and contextual understanding.",
      objects: ["screen content", "interface elements"],
      sentiment: "neutral",
      timestamp: new Date().toISOString()
    };
  }

  async getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      services: {
        webAutomation: !!this.services.webAutomation,
        computerVision: !!this.services.computerVision,
        androidControl: !!this.services.androidControl,
        textAnalysis: !!this.services.textAnalysis
      },
      timestamp: new Date().toISOString()
    };
  }

  async cleanup() {
    console.log('Cleaning up AI services...');

    if (browser) {
      await browser.close();
    }

    if (ocrWorker) {
      await ocrWorker.terminate();
    }

    console.log('AI services cleaned up');
  }
}

const aiServices = new UnifiedAIServices();

function createExpressServer() {
  expressApp = express();
  server = http.createServer(expressApp);
  io = new Server(server);

  // Middleware
  expressApp.use(express.json({ limit: '50mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS for development
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
  });

  // API Routes
  expressApp.post('/api/analyze-image', async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const result = await aiServices.analyzeImage(imageBuffer);
      res.json(result);
    } catch (error) {
      console.error('Image analysis error:', error);
      res.status(500).json({ error: 'Image analysis failed' });
    }
  });

  expressApp.post('/api/web-search', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'No search query provided' });
      }

      const result = await aiServices.performWebSearch(query);
      res.json(result);
    } catch (error) {
      console.error('Web search error:', error);
      res.status(500).json({ error: 'Web search failed' });
    }
  });

  expressApp.post('/api/process-screenshot', async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'No screenshot provided' });
      }

      const imageBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const result = await aiServices.processScreenshot(imageBuffer);
      res.json(result);
    } catch (error) {
      console.error('Screenshot processing error:', error);
      res.status(500).json({ error: 'Screenshot processing failed' });
    }
  });

  expressApp.get('/api/system-info', async (req, res) => {
    try {
      const info = await aiServices.getSystemInfo();
      res.json(info);
    } catch (error) {
      console.error('System info error:', error);
      res.status(500).json({ error: 'Failed to get system info' });
    }
  });

  // Socket.IO for real-time communication
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('chat-message', async (data) => {
      try {
        // Process the message and route to appropriate AI service
        const response = await processChatMessage(data);
        socket.emit('ai-response', response);
      } catch (error) {
        socket.emit('ai-error', { error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Start server on a random available port
  const port = 3001;
  server.listen(port, () => {
    console.log(`Embedded AI server running on port ${port}`);
  });
}

async function processChatMessage(data) {
  const { message, model = 'unified' } = data;

  // Route message to appropriate AI service based on content
  if (message.toLowerCase().includes('screenshot') || message.toLowerCase().includes('screen')) {
    return {
      type: 'screenshot_request',
      message: 'I can help you take and analyze screenshots. Please provide a screenshot image.',
      capabilities: ['ocr', 'image_analysis']
    };
  }

  if (message.toLowerCase().includes('search') || message.toLowerCase().includes('web')) {
    const query = message.toLowerCase().replace('search for', '').replace('search', '').trim();
    if (query) {
      const result = await aiServices.performWebSearch(query);
      return {
        type: 'web_search',
        message: `I found ${result.results.length} results for "${query}"`,
        data: result
      };
    }
  }

  if (message.toLowerCase().includes('analyze') || message.toLowerCase().includes('image')) {
    return {
      type: 'image_analysis_request',
      message: 'I can analyze images and extract text. Please provide an image to analyze.',
      capabilities: ['vision', 'ocr']
    };
  }

  // Default unified response
  return {
    type: 'chat_response',
    message: `I understand you want to: "${message}". I can help with screenshot analysis, web searches, image processing, and system automation. What would you like me to do?`,
    suggestions: [
      'Take a screenshot and analyze it',
      'Search the web for information',
      'Analyze an image or document',
      'Check system status'
    ]
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    },
    title: 'Unified AI Ecosystem - Embedded AI Platform',
    show: false,
    backgroundColor: '#0f0f23'
  });

  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', async () => {
    await aiServices.cleanup();
    if (server) {
      server.close();
    }
  });
}

// IPC handlers
ipcMain.handle('get-embedded-services', async () => {
  return await aiServices.getSystemInfo();
});

ipcMain.handle('take-screenshot', async () => {
  // In a real implementation, this would capture the screen
  // For now, return a mock response
  return {
    success: true,
    message: 'Screenshot captured (mock)',
    timestamp: new Date().toISOString()
  };
});

ipcMain.handle('analyze-image', async (event, imageData) => {
  try {
    const result = await aiServices.analyzeImage(Buffer.from(imageData, 'base64'));
    return result;
  } catch (error) {
    throw new Error(`Image analysis failed: ${error.message}`);
  }
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Initialize AI services
    await aiServices.initialize();

    // Create embedded server
    createExpressServer();

    // Create main window
    createWindow();

    console.log('Unified AI Ecosystem with embedded services started successfully');
  } catch (error) {
    console.error('Failed to initialize:', error);
    dialog.showErrorBox('Initialization Error', `Failed to start AI services: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

process.on('exit', async () => {
  await aiServices.cleanup();
});

process.on('SIGINT', async () => {
  await aiServices.cleanup();
  process.exit();
});

process.on('SIGTERM', async () => {
  await aiServices.cleanup();
  process.exit();
});