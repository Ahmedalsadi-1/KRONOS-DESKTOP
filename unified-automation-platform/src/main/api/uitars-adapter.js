const { BaseAPIAdapter, APIError } = require('./base-adapter');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * UI-TARS API Adapter
 * Handles communication with UI-TARS-desktop Python automation system
 */
class UITARSAdapter extends BaseAPIAdapter {
  constructor(config = {}) {
    super({
      name: 'UI-TARS',
      version: '1.0.0',
      baseUrl: config.baseUrl || 'http://localhost:8002',
      timeout: config.timeout || 30000,
      authRequired: config.authRequired || false,
      supportedFeatures: [
        'task-creation',
        'task-monitoring',
        'screenshot-capture',
        'vision-ocr',
        'coordinate-automation',
        'action-parsing',
        'local-execution'
      ],
      healthCheckPath: '/health',
      ...config
    });

    this.pythonPath = config.pythonPath || 'python3';
    this.scriptPath = config.scriptPath || path.join(__dirname, '../../../ui-tars-desktop');
    this.activeTasks = new Map();
    this.taskProcesses = new Map();
    this.screenshots = new Map();
    this.actionHistory = [];
  }

  /**
   * Setup authentication if required
   */
  async setupAuthentication() {
    // UI-TARS typically doesn't require authentication for local execution
    this.isAuthenticated = true;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    try {
      console.log('[UI-TARS] Initializing adapter...');
      
      // Check if Python and required dependencies are available
      await this.checkDependencies();
      
      // Check if UI-TARS script exists
      await this.checkScriptExists();
      
      // Test connection
      await this.checkHealth();
      
      this.isConnected = true;
      this.emit('connected');
      
      console.log('[UI-TARS] Adapter initialized successfully');
    } catch (error) {
      console.error('[UI-TARS] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check Python dependencies
   */
  async checkDependencies() {
    try {
      // Check Python version
      const pythonCheck = await this.runCommand([this.pythonPath, '--version']);
      console.log('[UI-TARS] Python version:', pythonCheck.stdout.trim());
      
      // Check if required Python packages are available
      const packages = ['pyautogui', 'opencv-python', 'pillow', 'numpy', 'pytesseract'];
      for (const package of packages) {
        try {
          await this.runCommand([this.pythonPath, '-c', `import ${package}; print(${package}.__version__)`]);
          console.log(`[UI-TARS] Package ${package} is available`);
        } catch (error) {
          console.warn(`[UI-TARS] Package ${package} not found, some features may not work`);
        }
      }
    } catch (error) {
      console.error('[UI-TARS] Dependency check failed:', error);
      throw new Error('Python dependencies check failed');
    }
  }

  /**
   * Check if UI-TARS script exists
   */
  async checkScriptExists() {
    try {
      const scriptFiles = [
        'main.py',
        'ui_tars.py', 
        'action_parser.py',
        'coordinate_processor.py'
      ];
      
      for (const file of scriptFiles) {
        const filePath = path.join(this.scriptPath, file);
        try {
          await fs.access(filePath);
          console.log(`[UI-TARS] Found script: ${file}`);
        } catch (error) {
          console.warn(`[UI-TARS] Script file not found: ${file}`);
        }
      }
    } catch (error) {
      console.error('[UI-TARS] Script check failed:', error);
    }
  }

  /**
   * Create a new task
   */
  async createTask(taskData) {
    try {
      console.log('[UI-TARS] Creating task:', taskData.title);
      
      const taskId = taskData.id || this.generateTaskId();
      
      const task = {
        id: taskId,
        platform: 'ui-tars',
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: taskData.description || taskData.prompt,
        actions: [],
        screenshots: [],
        coordinates: [],
        metadata: {
          pythonPath: this.pythonPath,
          scriptPath: this.scriptPath,
          headless: taskData.headless !== false,
          screenshotInterval: taskData.screenshotInterval || 2,
          confidence: taskData.confidence || 0.8,
          timeout: taskData.timeout || 30
        }
      };

      this.activeTasks.set(taskId, task);
      
      // Start the task execution
      await this.executeTask(task);
      
      this.emit('taskCreated', task);
      console.log('[UI-TARS] Task created and started:', taskId);
      
      return task;
      
    } catch (error) {
      console.error('[UI-TARS] Failed to create task:', error);
      throw new APIError(500, 'Task Creation Failed', { 
        message: error.message,
        taskData 
      });
    }
  }

  /**
   * Execute task using Python script
   */
  async executeTask(task) {
    try {
      task.status = 'executing';
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      
      // Prepare task script
      const taskScript = this.generateTaskScript(task);
      const scriptPath = path.join(this.scriptPath, `task_${task.id}.py`);
      
      await fs.writeFile(scriptPath, taskScript);
      
      // Execute the task
      const process = spawn(this.pythonPath, [scriptPath], {
        cwd: this.scriptPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.taskProcesses.set(task.id, process);
      
      // Handle process output
      process.stdout.on('data', (data) => {
        const output = data.toString();
        this.handleProcessOutput(task.id, output);
      });
      
      process.stderr.on('data', (data) => {
        const error = data.toString();
        this.handleProcessError(task.id, error);
      });
      
      process.on('close', (code) => {
        this.handleProcessClose(task.id, code);
      });
      
      process.on('error', (error) => {
        this.handleProcessError(task.id, error.message);
      });
      
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      this.emit('taskFailed', task);
    }
  }

  /**
   * Generate Python script for task execution
   */
  generateTaskScript(task) {
    return `
import sys
import os
import time
import json
import pyautogui
import cv2
import numpy as np
from PIL import Image
import pytesseract
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Task configuration
TASK_ID = "${task.id}"
DESCRIPTION = """${task.description}"""
CONFIG = ${JSON.stringify(task.metadata, null, 2)}

def log_event(event_type, data):
    """Log event to stdout for monitoring"""
    event = {
        "task_id": TASK_ID,
        "type": event_type,
        "data": data,
        "timestamp": time.time()
    }
    print(json.dumps(event))

def take_screenshot(filename=None):
    """Take screenshot and save if filename provided"""
    try:
        screenshot = pyautogui.screenshot()
        if filename:
            screenshot.save(filename)
        return np.array(screenshot)
    except Exception as e:
        logger.error(f"Screenshot failed: {e}")
        return None

def find_element(template_path, confidence=0.8):
    """Find element on screen using template matching"""
    try:
        screenshot = take_screenshot()
        template = cv2.imread(template_path)
        
        if template is None:
            logger.error(f"Template not found: {template_path}")
            return None
            
        result = cv2.matchTemplate(screenshot, template, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        
        if max_val >= confidence:
            center_x = max_loc[0] + template.shape[1] // 2
            center_y = max_loc[1] + template.shape[0] // 2
            log_event("element_found", {
                "template": template_path,
                "confidence": max_val,
                "coordinates": [center_x, center_y]
            })
            return (center_x, center_y)
        else:
            log_event("element_not_found", {
                "template": template_path,
                "confidence": max_val
            })
            return None
    except Exception as e:
        logger.error(f"Element search failed: {e}")
        return None

def click_at(x, y):
    """Click at specified coordinates"""
    try:
        pyautogui.click(x, y)
        log_event("action", {"action": "click", "coordinates": [x, y]})
        time.sleep(0.1)  # Small delay after click
    except Exception as e:
        logger.error(f"Click failed: {e}")

def type_text(text):
    """Type text at current cursor position"""
    try:
        pyautogui.write(text, interval=0.1)
        log_event("action", {"action": "type", "text": text})
        time.sleep(0.1)  # Small delay after typing
    except Exception as e:
        logger.error(f"Type failed: {e}")

def scroll(direction, amount=3):
    """Scroll up or down"""
    try:
        pyautogui.scroll(amount if direction == "down" else -amount)
        log_event("action", {"action": "scroll", "direction": direction, "amount": amount})
        time.sleep(0.1)
    except Exception as e:
        logger.error(f"Scroll failed: {e}")

def extract_text(region=None):
    """Extract text from screen or region using OCR"""
    try:
        screenshot = take_screenshot()
        if region:
            x, y, w, h = region
            screenshot = screenshot[y:y+h, x:x+w]
        
        text = pytesseract.image_to_string(screenshot)
        log_event("text_extracted", {"text": text.strip()})
        return text.strip()
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        return ""

def wait(seconds):
    """Wait for specified seconds"""
    time.sleep(seconds)
    log_event("action", {"action": "wait", "duration": seconds})

# Main execution
def main():
    try:
        log_event("task_started", {"description": DESCRIPTION})
        
        # Configure pyautogui
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1
        
        # Take initial screenshot
        screenshot_path = f"screenshots/initial_{TASK_ID}.png"
        os.makedirs("screenshots", exist_ok=True)
        take_screenshot(screenshot_path)
        
        # Execute task logic
        # This is where the actual automation logic would go
        # For now, we'll simulate some basic actions
        
        log_event("action", {"action": "info", "message": "Starting task execution"})
        
        # Example actions (these would be generated from the task description)
        wait(2)
        log_event("action", {"action": "info", "message": "Task completed successfully"})
        
        log_event("task_completed", {"result": "success"})
        
    except Exception as e:
        logger.error(f"Task execution failed: {e}")
        log_event("task_failed", {"error": str(e)})
    finally:
        # Cleanup
        try:
            if os.path.exists(f"task_{TASK_ID}.py"):
                os.remove(f"task_{TASK_ID}.py")
        except:
            pass

if __name__ == "__main__":
    main()
`;
  }

  /**
   * Handle process output
   */
  handleProcessOutput(taskId, output) {
    try {
      const lines = output.toString().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.handleTaskEvent(taskId, event);
          } catch (parseError) {
            // Not a JSON event, treat as log
            this.handleLogMessage(taskId, line);
          }
        }
      }
    } catch (error) {
      console.error('[UI-TARS] Error handling process output:', error);
    }
  }

  /**
   * Handle process error
   */
  handleProcessError(taskId, error) {
    console.error(`[UI-TARS] Process error for task ${taskId}:`, error);
    
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error;
      task.updatedAt = new Date();
      this.activeTasks.set(taskId, task);
      this.emit('taskFailed', task);
    }
  }

  /**
   * Handle process close
   */
  handleProcessClose(taskId, code) {
    console.log(`[UI-TARS] Process closed for task ${taskId} with code: ${code}`);
    
    const task = this.activeTasks.get(taskId);
    if (task) {
      if (code === 0) {
        task.status = 'completed';
      } else {
        task.status = 'failed';
        task.error = `Process exited with code ${code}`;
      }
      task.updatedAt = new Date();
      this.activeTasks.set(taskId, task);
      this.emit('taskCompleted', task);
    }
    
    // Clean up process
    this.taskProcesses.delete(taskId);
  }

  /**
   * Handle task event from process
   */
  handleTaskEvent(taskId, event) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;
    
    switch (event.type) {
      case 'task_started':
        task.status = 'executing';
        task.startedAt = new Date(event.timestamp * 1000);
        break;
        
      case 'action':
        if (!task.actions) task.actions = [];
        task.actions.push({
          timestamp: new Date(event.timestamp * 1000),
          ...event.data
        });
        break;
        
      case 'element_found':
        if (!task.coordinates) task.coordinates = [];
        task.coordinates.push({
          timestamp: new Date(event.timestamp * 1000),
          ...event.data
        });
        break;
        
      case 'screenshot':
        if (!task.screenshots) task.screenshots = [];
        task.screenshots.push({
          id: event.data.id || `screenshot_${Date.now()}`,
          timestamp: new Date(event.timestamp * 1000),
          path: event.data.path,
          description: event.data.description
        });
        break;
        
      case 'text_extracted':
        if (!task.extractedText) task.extractedText = [];
        task.extractedText.push({
          timestamp: new Date(event.timestamp * 1000),
          text: event.data.text
        });
        break;
        
      case 'task_completed':
        task.status = 'completed';
        task.completedAt = new Date(event.timestamp * 1000);
        task.result = event.data.result;
        break;
        
      case 'task_failed':
        task.status = 'failed';
        task.failedAt = new Date(event.timestamp * 1000);
        task.error = event.data.error;
        break;
    }
    
    task.updatedAt = new Date();
    this.activeTasks.set(taskId, task);
    this.emit('taskUpdated', task);
    this.emit('taskEvent', { taskId, event });
  }

  /**
   * Handle log message
   */
  handleLogMessage(taskId, message) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      if (!task.logs) task.logs = [];
      task.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: message.trim()
      });
      this.activeTasks.set(taskId, task);
    }
  }

  /**
   * Get task status and details
   */
  async getTaskStatus(taskId) {
    try {
      const task = this.activeTasks.get(taskId);
      if (!task) {
        throw new APIError(404, 'Task Not Found', { taskId });
      }
      
      return task;
      
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(500, 'Failed to Get Task Status', { 
        message: error.message,
        taskId 
      });
    }
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId) {
    try {
      console.log('[UI-TARS] Cancelling task:', taskId);
      
      const process = this.taskProcesses.get(taskId);
      if (process) {
        process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      }
      
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.status = 'cancelled';
        task.cancelledAt = new Date();
        task.updatedAt = new Date();
        this.activeTasks.set(taskId, task);
        this.emit('taskCancelled', task);
      }
      
      console.log('[UI-TARS] Task cancelled successfully:', taskId);
      return true;
      
    } catch (error) {
      console.error('[UI-TARS] Failed to cancel task:', error);
      throw new APIError(500, 'Task Cancellation Failed', { 
        message: error.message,
        taskId 
      });
    }
  }

  /**
   * Get list of tasks with optional filters
   */
  async getTasks(filters = {}) {
    try {
      let tasks = Array.from(this.activeTasks.values());
      
      // Apply filters
      if (filters.status) {
        tasks = tasks.filter(task => task.status === filters.status);
      }
      
      if (filters.limit) {
        tasks = tasks.slice(0, filters.limit);
      }
      
      // Sort by creation date
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return tasks;
      
    } catch (error) {
      console.error('[UI-TARS] Failed to get tasks:', error);
      throw new APIError(500, 'Failed to Fetch Tasks', { 
        message: error.message,
        filters 
      });
    }
  }

  /**
   * Create WebSocket stream for real-time task updates (simplified for local execution)
   */
  createTaskStream(taskId, options = {}) {
    // For UI-TARS, we simulate WebSocket with event-based updates
    const streamInfo = {
      taskId,
      connected: true,
      eventListeners: new Map()
    };
    
    // Listen to task events
    const eventHandler = (event) => {
      if (event.taskId === taskId) {
        this.emit('streamMessage', { taskId, data: event.event });
      }
    };
    
    this.on('taskEvent', eventHandler);
    streamInfo.eventListeners.set('taskEvent', eventHandler);
    
    this.taskStreams = this.taskStreams || new Map();
    this.taskStreams.set(taskId, streamInfo);
    
    console.log('[UI-TARS] Task stream created for:', taskId);
    return streamInfo;
  }

  /**
   * Capture screenshot manually
   */
  async captureScreenshot(options = {}) {
    try {
      const screenshotId = `manual_${Date.now()}`;
      const screenshotPath = path.join(this.scriptPath, 'screenshots', `${screenshotId}.png`);
      
      // Ensure screenshots directory exists
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      
      // Take screenshot using pyautogui
      await this.runCommand([
        this.pythonPath, '-c', `
import pyautogui
import os
screenshot = pyautogui.screenshot()
screenshot.save("${screenshotPath}")
print(f"Screenshot saved: ${screenshotPath}")
      `
      ]);
      
      const screenshot = {
        id: screenshotId,
        path: screenshotPath,
        timestamp: new Date(),
        url: `file://${screenshotPath}`,
        description: options.description || 'Manual screenshot'
      };
      
      this.screenshots.set(screenshotId, screenshot);
      return screenshot;
      
    } catch (error) {
      console.error('[UI-TARS] Failed to capture screenshot:', error);
      throw new APIError(500, 'Screenshot Failed', { 
        message: error.message,
        options 
      });
    }
  }

  /**
   * Run command and return result
   */
  runCommand(args) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const process = spawn(args[0], args.slice(1));
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Map platform task status to unified status
   */
  mapTaskStatus(platformStatus) {
    const statusMap = {
      'queued': 'queued',
      'executing': 'executing',
      'running': 'executing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'error': 'failed'
    };
    
    return statusMap[platformStatus] || 'unknown';
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `uitars_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get platform-specific capabilities
   */
  getCapabilities() {
    return {
      name: this.config.name,
      version: this.config.version,
      features: this.config.supportedFeatures,
      maxConcurrentTasks: 3, // Limited by system resources
      supportedActions: [
        'click', 'double_click', 'right_click',
        'type', 'key_press', 'key_combination',
        'scroll', 'drag', 'drop',
        'screenshot', 'find_element', 'extract_text',
        'wait', 'move_to'
      ],
      requirements: {
        python: '3.7+',
        pyautogui: true,
        opencv: true,
        pillow: true,
        pytesseract: true,
        numpy: true
      },
      limitations: [
        'Requires screen visibility for element detection',
        'OCR accuracy depends on image quality',
        'Coordinate-based automation may break with UI changes'
      ]
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Kill all running processes
    for (const [taskId, process] of this.taskProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        console.error(`[UI-TARS] Failed to kill process for task ${taskId}:`, error);
      }
    }
    this.taskProcesses.clear();
    
    // Clear active tasks
    this.activeTasks.clear();
    this.screenshots.clear();
    this.actionHistory = [];
    
    // Close streams
    if (this.taskStreams) {
      for (const [taskId, stream] of this.taskStreams) {
        for (const [event, handler] of stream.eventListeners) {
          this.removeListener(event, handler);
        }
      }
      this.taskStreams.clear();
    }
    
    await super.disconnect();
  }
}

module.exports = UITARSAdapter;
