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
    }
});
