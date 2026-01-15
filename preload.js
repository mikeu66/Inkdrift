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
    }
});
