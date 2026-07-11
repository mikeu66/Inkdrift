const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Storage operations
    saveTodos: (todos) => {
        // Input validation before sending to main process
        if (!Array.isArray(todos)) {
            throw new Error('Todos must be an array');
        }

        // Size limit to prevent DoS (max 10MB of JSON)
        const todosJson = JSON.stringify(todos);
        if (todosJson.length > 10 * 1024 * 1024) {
            throw new Error('Todos data too large (max 10MB)');
        }

        return ipcRenderer.invoke('save-todos', todos);
    },

    loadTodos: () => {
        return ipcRenderer.invoke('load-todos');
    },

    // Utility functions
    getAppVersion: () => {
        return ipcRenderer.invoke('get-app-version');
    },

    // Export/Import operations
    exportTodos: (todos) => {
        if (!Array.isArray(todos)) {
            throw new Error('Todos must be an array');
        }
        return ipcRenderer.invoke('export-todos', todos);
    },

    importTodos: () => {
        return ipcRenderer.invoke('import-todos');
    },

    // Brainstorming API
    callClaude: (params) => {
        // Validate params structure
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid params: must be an object');
        }
        if (!params.systemPrompt || typeof params.systemPrompt !== 'string') {
            throw new Error('Invalid params: systemPrompt must be a string');
        }
        if (!Array.isArray(params.messages)) {
            throw new Error('Invalid params: messages must be an array');
        }
        return ipcRenderer.invoke('call-claude', params);
    },

    checkClaudeAvailable: () => {
        return ipcRenderer.invoke('check-claude-available');
    },

    saveBrainstormFile: (content, suggestedFilename) => {
        if (typeof content !== 'string') {
            throw new Error('Content must be a string');
        }
        return ipcRenderer.invoke('save-brainstorm-file', { content, suggestedFilename });
    },

    // Settings API
    getSettings: () => {
        return ipcRenderer.invoke('get-settings');
    },

    saveApiKey: (apiKey) => {
        if (apiKey !== null && apiKey !== undefined && typeof apiKey !== 'string') {
            throw new Error('API key must be a string or empty');
        }
        return ipcRenderer.invoke('save-api-key', apiKey);
    },

    testApiKey: (apiKey) => {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('API key must be a non-empty string');
        }
        return ipcRenderer.invoke('test-api-key', apiKey);
    },

    // AI provider settings (Anthropic vs local Ollama)
    saveAiSettings: (aiSettings) => {
        if (!aiSettings || typeof aiSettings !== 'object') {
            throw new Error('AI settings must be an object');
        }
        return ipcRenderer.invoke('save-ai-settings', aiSettings);
    },

    listOllamaModels: (baseUrl) => {
        if (!baseUrl || typeof baseUrl !== 'string') {
            throw new Error('Base URL must be a non-empty string');
        }
        return ipcRenderer.invoke('list-ollama-models', baseUrl);
    },

    testOllamaConnection: (params) => {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid params: must be an object');
        }
        return ipcRenderer.invoke('test-ollama-connection', params);
    }
});
