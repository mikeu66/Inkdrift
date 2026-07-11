const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// SECURITY: Safe logging to prevent EPIPE errors in packaged apps
const safeLog = {
    log: (...args) => {
        try {
            console.log(...args);
        } catch (err) {
            // Silently ignore EPIPE errors in packaged apps
        }
    },
    error: (...args) => {
        try {
            console.error(...args);
        } catch (err) {
            // Silently ignore EPIPE errors in packaged apps
        }
    }
};

// SECURITY: List of allowed URL protocols for external links
const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:'];
const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:', 'file:'];

// Load environment variables from .env file
require('dotenv').config();
// Initialize Claude client (only if API key is available)
let claudeClient = null;
let Anthropic;
try {
    Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
    safeLog.error('CRITICAL: Failed to load @anthropic-ai/sdk:', e);
}

// Claude client will be initialized after app is ready (needs access to userData path)

// Lazy initialization state - prevents Keychain popup on startup
let claudeClientInitialized = false;
let migrationChecked = false;

// SECURITY: Rate limiting for Claude API calls
const rateLimiter = {
    calls: [],
    maxCallsPerMinute: 10,
    maxCallsPerHour: 60,

    canMakeCall() {
        const now = Date.now();
        // Remove calls older than 1 hour
        this.calls = this.calls.filter(time => now - time < 3600000);

        const callsInLastMinute = this.calls.filter(time => now - time < 60000).length;
        const callsInLastHour = this.calls.length;

        return callsInLastMinute < this.maxCallsPerMinute && callsInLastHour < this.maxCallsPerHour;
    },

    recordCall() {
        this.calls.push(Date.now());
    },

    getRemainingCalls() {
        const now = Date.now();
        this.calls = this.calls.filter(time => now - time < 3600000);
        const callsInLastMinute = this.calls.filter(time => now - time < 60000).length;
        return {
            perMinute: Math.max(0, this.maxCallsPerMinute - callsInLastMinute),
            perHour: Math.max(0, this.maxCallsPerHour - this.calls.length)
        };
    }
};

// Storage file paths (using app.getPath for proper user data directory)
const getStoragePath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'todos.json');
};

const getSettingsPath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'settings.json');
};

const getSecureKeyPath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'secure-key.bin');
};

// Secure API Key Storage using Electron's safeStorage
// Falls back to obfuscated file storage when OS encryption is unavailable
const FALLBACK_KEY_FILENAME = 'key-fallback.dat';

function getFallbackKeyPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, FALLBACK_KEY_FILENAME);
}

function saveApiKeyFallback(apiKey) {
    const fallbackPath = getFallbackKeyPath();
    const dir = path.dirname(fallbackPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    // Base64 encode — not secure encryption, but avoids plain text on disk
    const encoded = Buffer.from(apiKey, 'utf8').toString('base64');
    fs.writeFileSync(fallbackPath, encoded, 'utf8');
    safeLog.log('API key saved using fallback storage (OS encryption unavailable)');
}

function loadApiKeyFallback() {
    const fallbackPath = getFallbackKeyPath();
    if (!fs.existsSync(fallbackPath)) {
        return null;
    }
    const encoded = fs.readFileSync(fallbackPath, 'utf8');
    return Buffer.from(encoded, 'base64').toString('utf8');
}

function removeFallbackKey() {
    const fallbackPath = getFallbackKeyPath();
    if (fs.existsSync(fallbackPath)) {
        fs.unlinkSync(fallbackPath);
    }
}

function saveApiKeySecure(apiKey) {
    try {
        const secureKeyPath = getSecureKeyPath();
        const dir = path.dirname(secureKeyPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(apiKey);
            fs.writeFileSync(secureKeyPath, encrypted);
            // Clean up fallback file if it exists
            removeFallbackKey();
            safeLog.log('API key saved securely using OS encryption');
            return { saved: true, encrypted: true };
        }

        // Fallback: save with basic encoding when OS encryption is unavailable
        console.warn('Secure storage not available, falling back to basic storage');
        saveApiKeyFallback(apiKey);
        return { saved: true, encrypted: false };
    } catch (error) {
        safeLog.error('Error saving API key:', error);
        return { saved: false, encrypted: false };
    }
}

function loadApiKeySecure() {
    try {
        const secureKeyPath = getSecureKeyPath();

        // Try encrypted storage first
        if (fs.existsSync(secureKeyPath) && safeStorage.isEncryptionAvailable()) {
            const encrypted = fs.readFileSync(secureKeyPath);
            return safeStorage.decryptString(encrypted);
        }

        // Try fallback storage
        const fallbackKey = loadApiKeyFallback();
        if (fallbackKey) {
            return fallbackKey;
        }

        return null;
    } catch (error) {
        safeLog.error('Error loading API key:', error);
        return null;
    }
}

function removeApiKeySecure() {
    try {
        const secureKeyPath = getSecureKeyPath();
        if (fs.existsSync(secureKeyPath)) {
            fs.unlinkSync(secureKeyPath);
            safeLog.log('Secure API key removed');
        }
        removeFallbackKey();
        return true;
    } catch (error) {
        safeLog.error('Error removing secure API key:', error);
        return false;
    }
}

// Fast check if secure key file exists (NO Keychain access)
// Use this for UI checks to avoid triggering the macOS permission popup
function hasSecureKeyFile() {
    try {
        const secureKeyPath = getSecureKeyPath();
        return fs.existsSync(secureKeyPath);
    } catch {
        return false;
    }
}

// Check if there's a plain-text API key that needs migration (NO Keychain access)
function needsApiKeyMigration() {
    try {
        const settingsPath = getSettingsPath();
        if (!fs.existsSync(settingsPath)) {
            return false;
        }
        const data = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(data);
        return !!settings.anthropicApiKey;
    } catch {
        return false;
    }
}

// Ensure Claude client is initialized (lazy initialization)
// Only call this when user explicitly needs Claude features
function ensureClaudeClientInitialized() {
    if (claudeClientInitialized) {
        return claudeClient !== null;
    }

    claudeClientInitialized = true;

    // Run migration if needed (only accesses Keychain if there's something to migrate)
    if (!migrationChecked) {
        migrationChecked = true;
        if (needsApiKeyMigration()) {
            console.log('Plain-text API key found, migrating to secure storage...');
            migrateApiKeyToSecureStorage();
        }
    }

    // Initialize the client (only accesses Keychain if secure key file exists)
    initializeClaudeClient();

    return claudeClient !== null;
}

// Migrate from old plain-text storage to secure storage
function migrateApiKeyToSecureStorage() {
    try {
        const settingsPath = getSettingsPath();
        if (!fs.existsSync(settingsPath)) {
            return;
        }

        const data = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(data);

        // Check if there's an old plain-text API key
        if (settings.anthropicApiKey) {
            safeLog.log('Migrating API key to secure storage...');
            const migrated = saveApiKeySecure(settings.anthropicApiKey);

            if (migrated) {
                // Remove the plain-text key from settings
                delete settings.anthropicApiKey;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
                safeLog.log('API key migration complete - plain text key removed');
            }
        }
    } catch (error) {
        safeLog.error('Error during API key migration:', error);
    }
}

// Settings management (for non-sensitive settings)
function loadSettings() {
    try {
        const settingsPath = getSettingsPath();
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        safeLog.error('Error loading settings:', error);
    }
    return {};
}

function saveSettings(settings) {
    try {
        const settingsPath = getSettingsPath();
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Ensure API key is never saved in plain text settings
        const safeSettings = { ...settings };
        delete safeSettings.anthropicApiKey;
        fs.writeFileSync(settingsPath, JSON.stringify(safeSettings, null, 2), 'utf8');
        return true;
    } catch (error) {
        safeLog.error('Error saving settings:', error);
        return false;
    }
}

// AI provider settings (non-sensitive, stored in settings.json)
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

function getAiProviderSettings() {
    const settings = loadSettings();
    return {
        provider: settings.aiProvider === 'ollama' ? 'ollama' : 'anthropic',
        ollamaBaseUrl: settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL,
        ollamaModel: settings.ollamaModel || ''
    };
}

function validateOllamaBaseUrl(url) {
    if (typeof url !== 'string' || !url.trim()) {
        throw new Error('Ollama URL is required');
    }
    let parsed;
    try {
        parsed = new URL(url.trim());
    } catch {
        throw new Error('Invalid Ollama URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Ollama URL must use http or https');
    }
    // Strip trailing slash so path joining is predictable
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

// Ollama client (local HTTP API, no SDK needed)
const OLLAMA_GENERATE_TIMEOUT_MS = 120000; // local generation can be slow
const OLLAMA_PING_TIMEOUT_MS = 1500;
const OLLAMA_TAGS_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function callOllama({ systemPrompt, messages, options = {} }, { ollamaBaseUrl, ollamaModel }) {
    const body = {
        model: ollamaModel,
        stream: false,
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages.map(msg => ({ role: msg.role, content: msg.content }))
        ],
        options: {
            num_predict: options.max_tokens || 2048,
            temperature: options.temperature !== undefined ? options.temperature : 0.7
        }
    };
    // Constrain output for parse-dependent callers. A JSON-schema format is
    // used instead of format:'json' because the latter biases small models
    // toward emitting a single object instead of the expected array.
    if (options.responseFormat === 'json') {
        body.format = {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    hoursNeeded: { type: 'number' }
                },
                required: ['text'],
                additionalProperties: true
            }
        };
    }

    const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }, OLLAMA_GENERATE_TIMEOUT_MS);

    if (!response.ok) {
        let detail = '';
        try {
            const errBody = await response.json();
            detail = errBody.error || '';
        } catch {
            // Ignore unparseable error bodies
        }
        const err = new Error(detail || `Ollama request failed (HTTP ${response.status})`);
        err.httpStatus = response.status;
        throw err;
    }

    const data = await response.json();
    if (data.message && typeof data.message.content === 'string' && data.message.content.length > 0) {
        return data.message.content;
    }
    throw new Error('Empty response from Ollama');
}

async function fetchOllamaModels(ollamaBaseUrl) {
    const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/tags`, { method: 'GET' }, OLLAMA_TAGS_TIMEOUT_MS);
    if (!response.ok) {
        throw new Error(`Ollama request failed (HTTP ${response.status})`);
    }
    const data = await response.json();
    return Array.isArray(data.models) ? data.models.map(m => m.name) : [];
}

function friendlyOllamaError(error, ollamaBaseUrl, ollamaModel) {
    const message = error.message || '';
    if (error.name === 'AbortError') {
        return new Error('Ollama request timed out. The model may be too slow for this request.');
    }
    // Native fetch wraps network failures in TypeError with a cause
    if (error instanceof TypeError || (error.cause && error.cause.code === 'ECONNREFUSED')) {
        return new Error(`Cannot connect to Ollama at ${ollamaBaseUrl}. Is Ollama running? Start it with "ollama serve".`);
    }
    if (error.httpStatus === 404 || /model .* not found|not found, try pulling/i.test(message)) {
        return new Error(`Model "${ollamaModel}" not found. Pull it with "ollama pull ${ollamaModel}".`);
    }
    return new Error(message || 'Unknown Ollama error');
}

// Initialize Claude client from secure storage or environment
function initializeClaudeClient() {
    // Try secure storage first, then fall back to environment variable
    const apiKey = loadApiKeySecure() || process.env.ANTHROPIC_API_KEY;

    if (apiKey && Anthropic) {
        try {
            claudeClient = new Anthropic({
                apiKey: apiKey
            });
            safeLog.log('Claude client initialized successfully');
            return true;
        } catch (e) {
            safeLog.error('Failed to initialize Anthropic client:', e);
            claudeClient = null;
            return false;
        }
    }
    claudeClient = null;
    return false;
}

// Validate todos data structure
function validateTodos(todos) {
    if (!Array.isArray(todos)) {
        throw new Error('Invalid data: todos must be an array');
    }

    // SECURITY: Limit array size to prevent DoS
    const MAX_TODOS = 10000;
    if (todos.length > MAX_TODOS) {
        throw new Error(`Too many todos (max ${MAX_TODOS})`);
    }

    // Valid priority values
    const VALID_PRIORITIES = ['high', 'medium', 'low'];

    // Validate each todo item
    todos.forEach((todo, index) => {
        if (typeof todo !== 'object' || todo === null) {
            throw new Error(`Invalid todo at index ${index}: must be an object`);
        }

        // Validate required fields and types
        if (typeof todo.text !== 'string') {
            throw new Error(`Invalid todo at index ${index}: text must be a string`);
        }
        if (typeof todo.completed !== 'boolean') {
            throw new Error(`Invalid todo at index ${index}: completed must be a boolean`);
        }

        // Validate text length to prevent abuse
        if (todo.text.length > 10000) {
            throw new Error(`Invalid todo at index ${index}: text too long (max 10000 chars)`);
        }

        // Validate text is not empty after trimming
        if (todo.text.trim().length === 0) {
            throw new Error(`Invalid todo at index ${index}: text cannot be empty`);
        }

        if (todo.notes && typeof todo.notes !== 'string') {
            throw new Error(`Invalid todo at index ${index}: notes must be a string`);
        }
        if (todo.notes && todo.notes.length > 50000) {
            throw new Error(`Invalid todo at index ${index}: notes too long (max 50000 chars)`);
        }

        // SECURITY: Validate priority field
        if (todo.priority !== undefined) {
            if (typeof todo.priority !== 'string' || !VALID_PRIORITIES.includes(todo.priority)) {
                throw new Error(`Invalid todo at index ${index}: priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
            }
        }

        // SECURITY: Validate inProgress field
        if (todo.inProgress !== undefined && typeof todo.inProgress !== 'boolean') {
            throw new Error(`Invalid todo at index ${index}: inProgress must be a boolean`);
        }

        // SECURITY: Validate createdAt field
        if (todo.createdAt !== undefined) {
            if (typeof todo.createdAt !== 'number' || !Number.isFinite(todo.createdAt) || todo.createdAt < 0) {
                throw new Error(`Invalid todo at index ${index}: createdAt must be a valid timestamp`);
            }
        }

        // SECURITY: Validate id field
        if (todo.id !== undefined && typeof todo.id !== 'string') {
            throw new Error(`Invalid todo at index ${index}: id must be a string`);
        }

        // SECURITY: Validate subtasks field
        if (todo.subtasks !== undefined) {
            if (!Array.isArray(todo.subtasks)) {
                throw new Error(`Invalid todo at index ${index}: subtasks must be an array`);
            }
            if (todo.subtasks.length > 1000) {
                throw new Error(`Invalid todo at index ${index}: too many subtasks (max 1000)`);
            }
        }

        // SECURITY: Validate stage field
        const VALID_STAGES = ['brainstorm', 'planning', 'development', 'refinement', 'testing', 'done'];
        if (todo.stage !== undefined) {
            if (typeof todo.stage !== 'string' || !VALID_STAGES.includes(todo.stage)) {
                throw new Error(`Invalid todo at index ${index}: stage must be one of: ${VALID_STAGES.join(', ')}`);
            }
        }

        // SECURITY: Validate deletedAt field
        if (todo.deletedAt !== undefined && todo.deletedAt !== null && typeof todo.deletedAt !== 'string') {
            throw new Error(`Invalid todo at index ${index}: deletedAt must be a string or null`);
        }

        // SECURITY: Validate order field
        if (todo.order !== undefined) {
            if (typeof todo.order !== 'number' || !Number.isFinite(todo.order)) {
                throw new Error(`Invalid todo at index ${index}: order must be a number`);
            }
        }

        // SECURITY: Validate brainstormResult field
        if (todo.brainstormResult !== undefined && typeof todo.brainstormResult !== 'string') {
            throw new Error(`Invalid todo at index ${index}: brainstormResult must be a string`);
        }
        if (todo.brainstormResult && todo.brainstormResult.length > 100000) {
            throw new Error(`Invalid todo at index ${index}: brainstormResult too long (max 100000 chars)`);
        }

        // SECURITY: Validate actionItems field
        if (todo.actionItems !== undefined) {
            if (!Array.isArray(todo.actionItems)) {
                throw new Error(`Invalid todo at index ${index}: actionItems must be an array`);
            }
            if (todo.actionItems.length > 1000) {
                throw new Error(`Invalid todo at index ${index}: too many action items (max 1000)`);
            }
            // Validate children sub-arrays on each action item
            todo.actionItems.forEach((item, itemIndex) => {
                if (item.children !== undefined) {
                    if (!Array.isArray(item.children)) {
                        throw new Error(`Invalid todo at index ${index}, action item ${itemIndex}: children must be an array`);
                    }
                    if (item.children.length > 50) {
                        throw new Error(`Invalid todo at index ${index}, action item ${itemIndex}: too many children (max 50)`);
                    }
                    item.children.forEach((child, childIndex) => {
                        if (typeof child !== 'object' || child === null) {
                            throw new Error(`Invalid todo at index ${index}, action item ${itemIndex}, child ${childIndex}: must be an object`);
                        }
                        if (typeof child.text !== 'string') {
                            throw new Error(`Invalid todo at index ${index}, action item ${itemIndex}, child ${childIndex}: text must be a string`);
                        }
                        if (child.text.length > 10000) {
                            throw new Error(`Invalid todo at index ${index}, action item ${itemIndex}, child ${childIndex}: text too long (max 10000 chars)`);
                        }
                    });
                }
            });
        }

        // SECURITY: Check for unexpected properties (prevent prototype pollution)
        const allowedKeys = ['id', 'text', 'completed', 'notes', 'priority', 'inProgress', 'createdAt', 'subtasks', 'stage', 'deletedAt', 'order', 'brainstormResult', 'actionItems', 'manualActionItems'];
        const todoKeys = Object.keys(todo);
        for (const key of todoKeys) {
            if (!allowedKeys.includes(key)) {
                throw new Error(`Invalid todo at index ${index}: unexpected property '${key}'`);
            }
        }
    });

    return true;
}

// Secure IPC Handlers
function setupIpcHandlers() {
    // Save todos to file
    ipcMain.handle('save-todos', async (event, todos) => {
        try {
            // Validate input
            validateTodos(todos);

            // Save to file
            const storagePath = getStoragePath();
            const data = JSON.stringify(todos, null, 2);

            // Ensure directory exists
            const dir = path.dirname(storagePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(storagePath, data, 'utf8');
            return { success: true };
        } catch (error) {
            safeLog.error('Error saving todos:', error);
            throw error;
        }
    });

    // Load todos from file
    ipcMain.handle('load-todos', async (event) => {
        try {
            const storagePath = getStoragePath();

            // Check if file exists
            if (!fs.existsSync(storagePath)) {
                return [];
            }

            const data = fs.readFileSync(storagePath, 'utf8');
            const todos = JSON.parse(data);

            // Validate loaded data
            validateTodos(todos);

            return todos;
        } catch (error) {
            safeLog.error('Error loading todos:', error);
            // Return empty array on error rather than failing
            return [];
        }
    });

    // Get app version
    ipcMain.handle('get-app-version', async (event) => {
        return app.getVersion();
    });

    // Export todos to file
    ipcMain.handle('export-todos', async (event, todos) => {
        try {
            // Validate input
            validateTodos(todos);

            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'Export Tasks',
                defaultPath: `todos-backup-${new Date().toISOString().split('T')[0]}.json`,
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['createDirectory', 'showOverwriteConfirmation']
            });

            // User cancelled
            if (result.canceled) {
                return { success: false, cancelled: true };
            }

            // Create export data with metadata
            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                appVersion: app.getVersion(),
                todos: todos
            };

            // Write to selected file
            fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8');

            return { success: true, filePath: result.filePath };
        } catch (error) {
            safeLog.error('Error exporting todos:', error);
            throw error;
        }
    });

    // Import todos from file
    ipcMain.handle('import-todos', async (event) => {
        try {
            // Show open dialog
            const result = await dialog.showOpenDialog({
                title: 'Import Tasks',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            // User cancelled
            if (result.canceled) {
                return { success: false, cancelled: true };
            }

            const filePath = result.filePaths[0];

            // Check file size (10MB limit matching existing validation)
            const stats = fs.statSync(filePath);
            if (stats.size > 10 * 1024 * 1024) {
                throw new Error('File too large (max 10MB)');
            }

            // Read and parse file
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);

            // Support both new format (with metadata) and legacy format (plain array)
            let todos;
            if (Array.isArray(data)) {
                // Legacy format: plain array
                todos = data;
            } else if (data.version && Array.isArray(data.todos)) {
                // New format: wrapped with metadata
                todos = data.todos;
            } else {
                throw new Error('Invalid file format: expected todo array or export metadata object');
            }

            // Validate todos structure
            validateTodos(todos);

            return {
                success: true,
                todos: todos,
                count: todos.length,
                metadata: {
                    version: data.version || 'legacy',
                    exportDate: data.exportDate || null,
                    appVersion: data.appVersion || null
                }
            };
        } catch (error) {
            safeLog.error('Error importing todos:', error);
            // Return structured error for better UI feedback
            return {
                success: false,
                error: error.message,
                errorType: error instanceof SyntaxError ? 'INVALID_JSON' : 'VALIDATION_ERROR'
            };
        }
    });

    // Call the active AI provider (Anthropic Claude or local Ollama)
    ipcMain.handle('call-claude', async (event, params) => {
        const aiSettings = getAiProviderSettings();
        try {
            const { systemPrompt, messages, options = {} } = params;

            // SECURITY: Input validation for API parameters (both providers)
            if (systemPrompt && systemPrompt.length > 10000) {
                throw new Error('System prompt too long (max 10000 characters)');
            }
            if (messages.length > 50) {
                throw new Error('Too many messages (max 50)');
            }
            for (const msg of messages) {
                if (typeof msg.content === 'string' && msg.content.length > 50000) {
                    throw new Error('Message content too long (max 50000 characters)');
                }
            }

            if (aiSettings.provider === 'ollama') {
                // Local provider: no API key, no rate limiting.
                // options.model from the renderer is intentionally ignored;
                // the model comes from the Ollama settings instead.
                if (!aiSettings.ollamaModel) {
                    throw new Error('No Ollama model selected. Choose one in Settings.');
                }

                safeLog.log('[IPC] Calling Ollama...');
                const text = await callOllama({ systemPrompt, messages, options }, aiSettings);
                safeLog.log('[IPC] Ollama call successful');
                return {
                    success: true,
                    text
                };
            }

            // Lazy initialize Claude client when first needed
            ensureClaudeClientInitialized();

            if (!claudeClient) {
                throw new Error('Claude client not initialized. Please configure your API key in Settings.');
            }

            // SECURITY: Rate limiting check
            if (!rateLimiter.canMakeCall()) {
                const remaining = rateLimiter.getRemainingCalls();
                throw new Error(`Rate limit exceeded. Please wait before making more requests. Remaining: ${remaining.perMinute}/min, ${remaining.perHour}/hour`);
            }

            safeLog.log('[IPC] Calling Claude API for brainstorming...');
            rateLimiter.recordCall();

            const response = await claudeClient.messages.create({
                model: options.model || 'claude-haiku-4-5',
                max_tokens: options.max_tokens || 2048,
                temperature: options.temperature || 1.0,
                system: systemPrompt,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            });

            // Extract text from response
            if (response.content && response.content.length > 0) {
                const text = response.content[0].text;
                safeLog.log('[IPC] Claude API call successful');
                return {
                    success: true,
                    text
                };
            }

            throw new Error('Empty response from Claude API');

        } catch (error) {
            safeLog.error('[IPC] Error calling AI provider:', error);
            const friendly = aiSettings.provider === 'ollama'
                ? friendlyOllamaError(error, aiSettings.ollamaBaseUrl, aiSettings.ollamaModel)
                : error;
            return {
                success: false,
                error: friendly.message
            };
        }
    });

    // Cache Ollama reachability so per-feature prechecks don't stack latency
    let ollamaPingCache = { baseUrl: null, reachable: false, checkedAt: 0 };
    const OLLAMA_PING_CACHE_MS = 10000;

    async function isOllamaReachable(ollamaBaseUrl) {
        const now = Date.now();
        if (ollamaPingCache.baseUrl === ollamaBaseUrl && now - ollamaPingCache.checkedAt < OLLAMA_PING_CACHE_MS) {
            return ollamaPingCache.reachable;
        }
        let reachable = false;
        try {
            const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/tags`, { method: 'GET' }, OLLAMA_PING_TIMEOUT_MS);
            reachable = response.ok;
        } catch {
            reachable = false;
        }
        ollamaPingCache = { baseUrl: ollamaBaseUrl, reachable, checkedAt: now };
        return reachable;
    }

    // Check if the active AI provider is available (uses fast check to avoid Keychain popup)
    ipcMain.handle('check-claude-available', async () => {
        const aiSettings = getAiProviderSettings();

        if (aiSettings.provider === 'ollama') {
            const ollamaReachable = await isOllamaReachable(aiSettings.ollamaBaseUrl);
            return {
                available: ollamaReachable && !!aiSettings.ollamaModel,
                provider: 'ollama',
                ollamaReachable,
                ollamaModel: aiSettings.ollamaModel
            };
        }

        // Use fast file-existence check instead of decrypting (no Keychain access)
        const hasSecureKey = hasSecureKeyFile();
        const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;

        // If client has been initialized, report actual status
        // Otherwise, report potential availability based on key existence
        return {
            available: claudeClientInitialized ? (claudeClient !== null) : (hasSecureKey || hasEnvKey),
            provider: 'anthropic',
            hasApiKey: hasSecureKey || hasEnvKey,
            keySource: hasSecureKey ? 'secure' : (hasEnvKey ? 'environment' : 'none'),
            isEncrypted: hasSecureKey
        };
    });

    // Get settings (uses fast check to avoid Keychain popup on startup)
    ipcMain.handle('get-settings', async () => {
        // Use fast file-existence check instead of decrypting (no Keychain access)
        const hasSecureKey = hasSecureKeyFile();
        const aiSettings = getAiProviderSettings();
        return {
            hasApiKey: hasSecureKey,
            // Don't show preview by default to avoid Keychain access
            // The key preview will be shown after user explicitly tests/saves a key
            apiKeyPreview: hasSecureKey ? '••••••••••••••••' : null,
            isEncrypted: hasSecureKey,
            provider: aiSettings.provider,
            ollamaBaseUrl: aiSettings.ollamaBaseUrl,
            ollamaModel: aiSettings.ollamaModel
        };
    });

    // Save AI provider settings (non-sensitive, stored in settings.json)
    ipcMain.handle('save-ai-settings', async (event, aiSettings) => {
        try {
            if (!aiSettings || typeof aiSettings !== 'object') {
                throw new Error('Invalid settings');
            }
            const settings = loadSettings();

            if (aiSettings.provider !== undefined) {
                if (aiSettings.provider !== 'anthropic' && aiSettings.provider !== 'ollama') {
                    throw new Error('Invalid provider');
                }
                settings.aiProvider = aiSettings.provider;
            }
            if (aiSettings.ollamaBaseUrl !== undefined) {
                settings.ollamaBaseUrl = validateOllamaBaseUrl(aiSettings.ollamaBaseUrl);
            }
            if (aiSettings.ollamaModel !== undefined) {
                if (typeof aiSettings.ollamaModel !== 'string' || aiSettings.ollamaModel.length > 200) {
                    throw new Error('Invalid model name');
                }
                settings.ollamaModel = aiSettings.ollamaModel.trim();
            }

            if (!saveSettings(settings)) {
                throw new Error('Failed to save settings');
            }
            // Provider/URL may have changed — drop the cached ping result
            ollamaPingCache = { baseUrl: null, reachable: false, checkedAt: 0 };
            return { success: true };
        } catch (error) {
            safeLog.error('[IPC] Error saving AI settings:', error);
            return { success: false, error: error.message };
        }
    });

    // List models installed in a local Ollama instance
    ipcMain.handle('list-ollama-models', async (event, baseUrl) => {
        try {
            const validUrl = validateOllamaBaseUrl(baseUrl);
            const models = await fetchOllamaModels(validUrl);
            return { success: true, models };
        } catch (error) {
            safeLog.error('[IPC] Error listing Ollama models:', error);
            const friendly = friendlyOllamaError(error, baseUrl, '');
            return { success: false, error: friendly.message };
        }
    });

    // Test connection to a local Ollama instance (mirrors test-api-key's result shape)
    ipcMain.handle('test-ollama-connection', async (event, params) => {
        const { baseUrl, model } = params || {};
        try {
            const validUrl = validateOllamaBaseUrl(baseUrl);
            const models = await fetchOllamaModels(validUrl);
            const modelFound = !!model && models.includes(model);
            return { valid: true, models, modelFound };
        } catch (error) {
            safeLog.error('[IPC] Error testing Ollama connection:', error);
            const friendly = friendlyOllamaError(error, baseUrl, model || '');
            return { valid: false, error: friendly.message };
        }
    });

    // Save API key (uses secure storage - triggers Keychain access intentionally)
    ipcMain.handle('save-api-key', async (event, apiKey) => {
        try {
            // Validate API key format (basic check)
            if (apiKey && typeof apiKey !== 'string') {
                throw new Error('Invalid API key format');
            }

            // Mark as initialized since we're explicitly accessing secure storage
            claudeClientInitialized = true;

            if (apiKey && apiKey.trim()) {
                const trimmedKey = apiKey.trim();
                // Save to secure storage (triggers Keychain access - this is expected since user is explicitly saving)
                const saved = saveApiKeySecure(trimmedKey);
                if (!saved) {
                    throw new Error('Failed to save API key securely. Encryption may not be available.');
                }

                // Reinitialize Claude client with new key
                const initialized = initializeClaudeClient();

                return {
                    success: true,
                    claudeAvailable: initialized,
                    isEncrypted: safeStorage.isEncryptionAvailable(),
                    // Return preview since we already have the key
                    apiKeyPreview: `${trimmedKey.substring(0, 7)}...${trimmedKey.slice(-4)}`
                };
            } else {
                // Remove from secure storage
                removeApiKeySecure();

                // Reset Claude client
                claudeClient = null;

                return {
                    success: true,
                    claudeAvailable: false,
                    isEncrypted: false,
                    apiKeyPreview: null
                };
            }
        } catch (error) {
            safeLog.error('Error saving API key:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Test API key validity
    ipcMain.handle('test-api-key', async (event, apiKey) => {
        try {
            if (!apiKey || !Anthropic) {
                return { valid: false, error: 'No API key provided' };
            }

            // Create temporary client to test
            const testClient = new Anthropic({ apiKey: apiKey.trim() });

            // Make a minimal API call to verify the key works
            const response = await testClient.messages.create({
                model: 'claude-haiku-4-5',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            });

            return { valid: true };
        } catch (error) {
            safeLog.error('API key test failed:', error);
            return {
                valid: false,
                error: error.message || 'Invalid API key'
            };
        }
    });

    // Save brainstorm result to markdown file
    ipcMain.handle('save-brainstorm-file', async (event, { content, suggestedFilename }) => {
        try {
            const result = await dialog.showSaveDialog({
                title: 'Save Project Plan',
                defaultPath: suggestedFilename || `project-plan-${new Date().toISOString().split('T')[0]}.md`,
                filters: [
                    { name: 'Markdown Files', extensions: ['md'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['createDirectory', 'showOverwriteConfirmation']
            });

            if (result.canceled) {
                return { success: false, cancelled: true };
            }

            // Ensure directory exists
            const dir = path.dirname(result.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(result.filePath, content, 'utf8');

            return { success: true, filePath: result.filePath };
        } catch (error) {
            safeLog.error('Error saving brainstorm file:', error);
            return { success: false, error: error.message };
        }
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'icon.icns'),
        webPreferences: {
            // SECURITY: Disable direct Node.js access from renderer
            nodeIntegration: false,
            // SECURITY: Enable context isolation to prevent prototype pollution
            contextIsolation: true,
            // SECURITY: Enable sandbox for additional process isolation
            sandbox: true,
            // SECURITY: Use preload script for secure IPC bridge
            preload: path.join(__dirname, 'preload.js'),
            // SECURITY: Ensure web security is enabled
            webSecurity: true,
            // SECURITY: Disable insecure content
            allowRunningInsecureContent: false
        },
        backgroundColor: '#1a1a1a'
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    // SECURITY: Handle external links safely
    win.webContents.setWindowOpenHandler(({ url }) => {
        // Block dangerous protocols
        try {
            const urlObj = new URL(url);
            if (DANGEROUS_PROTOCOLS.includes(urlObj.protocol)) {
                console.warn(`Blocked dangerous URL protocol: ${urlObj.protocol}`);
                return { action: 'deny' };
            }
            // Open safe external links in system browser
            if (SAFE_PROTOCOLS.includes(urlObj.protocol)) {
                shell.openExternal(url);
            }
        } catch (e) {
            console.warn('Invalid URL blocked:', url);
        }
        return { action: 'deny' };
    });

    // SECURITY: Prevent navigation to external URLs
    win.webContents.on('will-navigate', (event, url) => {
        const appUrl = `file://${path.join(__dirname, 'index.html')}`;
        if (!url.startsWith('file://') || !url.includes(__dirname)) {
            console.warn(`Blocked navigation to: ${url}`);
            event.preventDefault();
        }
    });

    // Only enable DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    // NOTE: Claude client and API key migration are now lazy-loaded
    // This prevents the macOS Keychain permission popup from appearing on startup
    // for users who don't use Claude features. Access happens only when:
    // 1. User explicitly saves/tests an API key in Settings
    // 2. User tries to use Claude features (brainstorming)

    // Setup secure IPC handlers
    setupIpcHandlers();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
