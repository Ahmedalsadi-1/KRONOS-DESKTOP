/**
 * Enhanced Browser Controller for KRONOS Platform
 * Advanced web automation with AI-powered features
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import { chromium } from 'playwright';

// Types for Browser Automation
export interface BrowserSession {
  id: string;
  browserId: string;
  url: string;
  title: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  lastActivity: Date;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface WebElement {
  id: string;
  selector: string;
  type: string;
  tagName: string;
  text?: string;
  value?: string;
  href?: string;
  src?: string;
  alt?: string;
  visible: boolean;
  enabled: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes: Record<string, string>;
  children?: WebElement[];
  parent?: WebElement;
}

export interface AutomationAction {
  id: string;
  sessionId: string;
  type: 'navigate' | 'click' | 'type' | 'select' | 'scroll' | 'wait' | 'screenshot' | 'extract' | 'upload' | 'download';
  parameters: Record<string, any>;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executionTime: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  selector?: string;
  value?: string;
  waitFor?: string;
  screenshot?: boolean;
  extract?: string[];
  conditions?: Condition[];
}

export interface Condition {
  type: 'element_exists' | 'element_visible' | 'text_contains' | 'url_matches' | 'wait_timeout';
  selector?: string;
  text?: string;
  pattern?: string;
  timeout?: number;
}

export interface AIInsight {
  type: 'performance' | 'accessibility' | 'security' | 'seo' | 'user_experience';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  element?: WebElement;
  timestamp: Date;
}

export class EnhancedBrowserController extends EventEmitter {
  private browsers: Map<string, Browser> = new Map();
  private pages: Map<string, Page> = new Map();
  private sessions: Map<string, BrowserSession> = new Map();
  private actions: Map<string, AutomationAction> = new Map();
  private runningActions: Set<string> = new Set();
  private aiAnalysisEnabled: boolean = true;
  private screenshotOnError: boolean = true;
  private defaultViewport = { width: 1920, height: 1080 };
  private maxConcurrentSessions: number = 10;

  constructor() {
    super();
    this.initializeCleanup();
  }

  /**
   * Initialize cleanup interval for orphaned sessions
   */
  private initializeCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Create new browser session
   */
  async createSession(options: {
    headless?: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
    proxy?: string;
    extensions?: string[];
  } = {}): Promise<BrowserSession> {
    if (this.sessions.size >= this.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions (${this.maxConcurrentSessions}) reached`);
    }

    const sessionId = uuidv4();
    const browserId = uuidv4();

    try {
      // Launch browser with Playwright for better compatibility
      const browser = await chromium.launch({
        headless: options.headless ?? false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      const context = await browser.newContext({
        viewport: options.viewport || this.defaultViewport,
        userAgent: options.userAgent,
        proxy: options.proxy ? { server: options.proxy } : undefined
      });

      const page = await context.newPage();

      // Set up event listeners
      page.on('pageerror', (error) => {
        this.emit('pageError', { sessionId, error });
        if (this.screenshotOnError) {
          this.takeScreenshot(sessionId, 'error_screenshot').catch(console.error);
        }
      });

      page.on('console', (msg) => {
        this.emit('consoleMessage', { sessionId, type: msg.type(), text: msg.text() });
      });

      // Store browser and session
      this.browsers.set(browserId, browser);
      this.pages.set(sessionId, page);

      const session: BrowserSession = {
        id: sessionId,
        browserId,
        url: 'about:blank',
        title: 'New Session',
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        userAgent: options.userAgent || 'KRONOS Browser Controller',
        viewport: options.viewport || this.defaultViewport,
        cookies: [],
        localStorage: {},
        sessionStorage: {}
      };

      this.sessions.set(sessionId, session);
      this.emit('sessionCreated', session);

      return session;

    } catch (error) {
      this.emit('error', new Error(`Failed to create session: ${error.message}`));
      throw error;
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(sessionId: string, url: string, options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'networkidle0';
    timeout?: number;
  } = {}): Promise<void> {
    const page = this.pages.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (!page || !session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actionId = uuidv4();

    const action: AutomationAction = {
      id: actionId,
      sessionId,
      type: 'navigate',
      parameters: { url, ...options },
      timestamp: new Date(),
      status: 'executing',
      executionTime: 0
    };

    this.actions.set(actionId, action);
    this.runningActions.add(actionId);

    try {
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle',
        timeout: options.timeout || 30000
      });

      // Update session info
      session.url = page.url();
      session.title = await page.title();
      session.lastActivity = new Date();

      action.status = 'completed';
      action.result = { url: session.url, title: session.title };
      action.executionTime = Date.now() - startTime;

      this.emit('navigationCompleted', { sessionId, url, title: session.title });

    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.executionTime = Date.now() - startTime;
      
      this.emit('navigationFailed', { sessionId, url, error: error.message });
      throw error;

    } finally {
      this.runningActions.delete(actionId);
      this.actions.set(actionId, action);
    }
  }

  /**
   * Click element
   */
  async click(sessionId: string, selector: string, options: {
    delay?: number;
    force?: boolean;
    position?: { x: number; y: number };
  } = {}): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actionId = uuidv4();

    const action: AutomationAction = {
      id: actionId,
      sessionId,
      type: 'click',
      parameters: { selector, ...options },
      timestamp: new Date(),
      status: 'executing',
      executionTime: 0
    };

    this.actions.set(actionId, action);
    this.runningActions.add(actionId);

    try {
      const element = await page.waitForSelector(selector, { timeout: 10000 });
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      if (options.position) {
        await element.click({ position: options.position, delay: options.delay });
      } else {
        await element.click({ force: options.force, delay: options.delay });
      }

      action.status = 'completed';
      action.result = { clicked: selector };
      action.executionTime = Date.now() - startTime;

      this.emit('elementClicked', { sessionId, selector });

    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.executionTime = Date.now() - startTime;
      
      this.emit('elementClickFailed', { sessionId, selector, error: error.message });
      throw error;

    } finally {
      this.runningActions.delete(actionId);
      this.actions.set(actionId, action);
    }
  }

  /**
   * Type text into element
   */
  async type(sessionId: string, selector: string, text: string, options: {
    clear?: boolean;
    delay?: number;
    pressEnter?: boolean;
  } = {}): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actionId = uuidv4();

    const action: AutomationAction = {
      id: actionId,
      sessionId,
      type: 'type',
      parameters: { selector, text, ...options },
      timestamp: new Date(),
      status: 'executing',
      executionTime: 0
    };

    this.actions.set(actionId, action);
    this.runningActions.add(actionId);

    try {
      const element = await page.waitForSelector(selector, { timeout: 10000 });
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      if (options.clear) {
        await element.clear();
      }

      await element.type(text, { delay: options.delay || 10 });

      if (options.pressEnter) {
        await element.press('Enter');
      }

      action.status = 'completed';
      action.result = { typed: selector, text: text.substring(0, 50) + (text.length > 50 ? '...' : '') };
      action.executionTime = Date.now() - startTime;

      this.emit('textTyped', { sessionId, selector, text });

    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.executionTime = Date.now() - startTime;
      
      this.emit('textTypeFailed', { sessionId, selector, error: error.message });
      throw error;

    } finally {
      this.runningActions.delete(actionId);
      this.actions.set(actionId, action);
    }
  }

  /**
   * Select option from dropdown
   */
  async select(sessionId: string, selector: string, value: string | string[]): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actionId = uuidv4();

    const action: AutomationAction = {
      id: actionId,
      sessionId,
      type: 'select',
      parameters: { selector, value },
      timestamp: new Date(),
      status: 'executing',
      executionTime: 0
    };

    this.actions.set(actionId, action);
    this.runningActions.add(actionId);

    try {
      const element = await page.waitForSelector(selector, { timeout: 10000 });
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      await element.selectOption(value);

      action.status = 'completed';
      action.result = { selected: selector, value };
      action.executionTime = Date.now() - startTime;

      this.emit('optionSelected', { sessionId, selector, value });

    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.executionTime = Date.now() - startTime;
      
      this.emit('optionSelectFailed', { sessionId, selector, error: error.message });
      throw error;

    } finally {
      this.runningActions.delete(actionId);
      this.actions.set(actionId, action);
    }
  }

  /**
   * Scroll page
   */
  async scroll(sessionId: string, options: {
    x?: number;
    y?: number;
    behavior?: 'smooth' | 'auto';
    toBottom?: boolean;
    toTop?: boolean;
  } = {}): Promise<void> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actionId = uuidv4();

    const action: AutomationAction = {
      id: actionId,
      sessionId,
      type: 'scroll',
      parameters: options,
      timestamp: new Date(),
      status: 'executing',
      executionTime: 0
    };

    this.actions.set(actionId, action);
    this.runningActions.add(actionId);

    try {
      if (options.toBottom) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } else if (options.toTop) {
        await page.evaluate(() => window.scrollTo(0, 0));
      } else {
        await page.evaluate((scrollOptions) => {
          window.scrollTo(scrollOptions);
        }, {
          left: options.x || 0,
          top: options.y || 0,
          behavior: options.behavior || 'auto'
        });
      }

      action.status = 'completed';
      action.result = { scrolled: options };
      action.executionTime = Date.now() - startTime;

      this.emit('pageScrolled', { sessionId, options });

    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.executionTime = Date.now() - startTime;
      
      this.emit('pageScrollFailed', { sessionId, error: error.message });
      throw error;

    } finally {
      this.runningActions.delete(actionId);
      this.actions.set(actionId, action);
    }
  }

  /**
   * Wait for element or condition
   */
  async wait(sessionId: string, options: {
    selector?: string;
    timeout?: number;
    visible?: boolean;
    hidden?: boolean;
    text?: string;
    url?: string;
  } = {}): Promise<boolean> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const actionId = uuidv4();

    const action: AutomationAction = {
      id: actionId,
      sessionId,
      type: 'wait',
      parameters: options,
      timestamp: new Date(),
      status: 'executing',
      executionTime: 0
    };

    this.actions.set(actionId, action);
    this.runningActions.add(actionId);

    try {
      let result = false;

      if (options.selector) {
        if (options.visible) {
          await page.waitForSelector(options.selector, { 
            timeout: options.timeout || 10000,
            state: 'visible' 
          });
          result = true;
        } else if (options.hidden) {
          await page.waitForSelector(options.selector, { 
            timeout: options.timeout || 10000,
            state: 'hidden' 
          });
          result = true;
        } else {
          await page.waitForSelector(options.selector, { 
            timeout: options.timeout || 10000
          });
          result = true;
        }
      } else if (options.url) {
        await page.waitForURL(options.url, { timeout: options.timeout || 10000 });
        result = true;
      } else if (options.timeout) {
        await page.waitForTimeout(options.timeout);
        result = true;
      }

      action.status = 'completed';
      action.result = { waited: true, conditions: options };
      action.executionTime = Date.now() - startTime;

      this.emit('waitCompleted', { sessionId, options });

      return result;

    } catch (error) {
      action.status = 'failed';
      action.error = error.message;
      action.executionTime = Date.now() - startTime;
      
      this.emit('waitFailed', { sessionId, error: error.message });
      throw error;

    } finally {
      this.runningActions.delete(actionId);
      this.actions.set(actionId, action);
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(sessionId: string, name?: string): Promise<string> {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const screenshotName = name || `screenshot_${Date.now()}`;
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });

    this.emit
