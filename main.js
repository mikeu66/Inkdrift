const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
    console.error('CRITICAL: Failed to load @anthropic-ai/sdk:', e);
}

// Claude client will be initialized after app is ready (needs access to userData path)

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
function saveApiKeySecure(apiKey) {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            console.warn('Secure storage not available, falling back to basic storage');
            return false;
        }

        const secureKeyPath = getSecureKeyPath();
        const dir = path.dirname(secureKeyPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const encrypted = safeStorage.encryptString(apiKey);
        fs.writeFileSync(secureKeyPath, encrypted);
        console.log('API key saved securely using OS encryption');
        return true;
    } catch (error) {
        console.error('Error saving API key securely:', error);
        return false;
    }
}

function loadApiKeySecure() {
    try {
        const secureKeyPath = getSecureKeyPath();
        if (!fs.existsSync(secureKeyPath)) {
            return null;
        }

        if (!safeStorage.isEncryptionAvailable()) {
            console.warn('Secure storage not available for decryption');
            return null;
        }

        const encrypted = fs.readFileSync(secureKeyPath);
        const decrypted = safeStorage.decryptString(encrypted);
        return decrypted;
    } catch (error) {
        console.error('Error loading API key securely:', error);
        return null;
    }
}

function removeApiKeySecure() {
    try {
        const secureKeyPath = getSecureKeyPath();
        if (fs.existsSync(secureKeyPath)) {
            fs.unlinkSync(secureKeyPath);
            console.log('Secure API key removed');
        }
        return true;
    } catch (error) {
        console.error('Error removing secure API key:', error);
        return false;
    }
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
            console.log('Migrating API key to secure storage...');
            const migrated = saveApiKeySecure(settings.anthropicApiKey);

            if (migrated) {
                // Remove the plain-text key from settings
                delete settings.anthropicApiKey;
                fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
                console.log('API key migration complete - plain text key removed');
            }
        }
    } catch (error) {
        console.error('Error during API key migration:', error);
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
        console.error('Error loading settings:', error);
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
        console.error('Error saving settings:', error);
        return false;
    }
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
            console.log('Claude client initialized successfully');
            return true;
        } catch (e) {
            console.error('Failed to initialize Anthropic client:', e);
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

        // SECURITY: Check for unexpected properties (prevent prototype pollution)
        const allowedKeys = ['text', 'completed', 'notes', 'priority', 'inProgress', 'createdAt'];
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
            console.error('Error saving todos:', error);
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
            console.error('Error loading todos:', error);
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
            console.error('Error exporting todos:', error);
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
            console.error('Error importing todos:', error);
            // Return structured error for better UI feedback
            return {
                success: false,
                error: error.message,
                errorType: error instanceof SyntaxError ? 'INVALID_JSON' : 'VALIDATION_ERROR'
            };
        }
    });

    // Call Claude API for brainstorming
    ipcMain.handle('call-claude', async (event, params) => {
        try {
            if (!claudeClient) {
                throw new Error('Claude client not initialized. Set ANTHROPIC_API_KEY environment variable.');
            }

            // SECURITY: Rate limiting check
            if (!rateLimiter.canMakeCall()) {
                const remaining = rateLimiter.getRemainingCalls();
                throw new Error(`Rate limit exceeded. Please wait before making more requests. Remaining: ${remaining.perMinute}/min, ${remaining.perHour}/hour`);
            }

            const { systemPrompt, messages, options = {} } = params;

            // SECURITY: Input validation for API parameters
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

            console.log('[IPC] Calling Claude API for brainstorming...');
            rateLimiter.recordCall();

            const response = await claudeClient.messages.create({
                model: options.model || 'claude-3-haiku-20240307',
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
                console.log('[IPC] Claude API call successful');
                return {
                    success: true,
                    text
                };
            }

            throw new Error('Empty response from Claude API');

        } catch (error) {
            console.error('[IPC] Error calling Claude API:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Check if Claude API is available
    ipcMain.handle('check-claude-available', async () => {
        const secureKey = loadApiKeySecure();
        const hasSecureKey = !!secureKey;
        const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;
        return {
            available: claudeClient !== null,
            hasApiKey: hasSecureKey || hasEnvKey,
            keySource: hasSecureKey ? 'secure' : (hasEnvKey ? 'environment' : 'none'),
            isEncrypted: hasSecureKey && safeStorage.isEncryptionAvailable()
        };
    });

    // Get settings (without exposing sensitive data fully)
    ipcMain.handle('get-settings', async () => {
        const secureKey = loadApiKeySecure();
        return {
            hasApiKey: !!secureKey,
            apiKeyPreview: secureKey
                ? `${secureKey.substring(0, 7)}...${secureKey.slice(-4)}`
                : null,
            isEncrypted: safeStorage.isEncryptionAvailable()
        };
    });

    // Save API key (uses secure storage)
    ipcMain.handle('save-api-key', async (event, apiKey) => {
        try {
            // Validate API key format (basic check)
            if (apiKey && typeof apiKey !== 'string') {
                throw new Error('Invalid API key format');
            }

            if (apiKey && apiKey.trim()) {
                // Save to secure storage
                const saved = saveApiKeySecure(apiKey.trim());
                if (!saved) {
                    throw new Error('Failed to save API key securely. Encryption may not be available.');
                }
            } else {
                // Remove from secure storage
                removeApiKeySecure();
            }

            // Reinitialize Claude client with new key
            const initialized = initializeClaudeClient();

            return {
                success: true,
                claudeAvailable: initialized,
                isEncrypted: safeStorage.isEncryptionAvailable()
            };
        } catch (error) {
            console.error('Error saving API key:', error);
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
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }]
            });

            return { valid: true };
        } catch (error) {
            console.error('API key test failed:', error);
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
            console.error('Error saving brainstorm file:', error);
            return { success: false, error: error.message };
        }
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'logo.png'),
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
    // Migrate any existing plain-text API keys to secure storage
    migrateApiKeyToSecureStorage();

    // Initialize Claude client from secure storage or environment
    initializeClaudeClient();

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
