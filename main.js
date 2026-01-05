const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Storage file path (using app.getPath for proper user data directory)
const getStoragePath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'todos.json');
};

// Validate todos data structure
function validateTodos(todos) {
    if (!Array.isArray(todos)) {
        throw new Error('Invalid data: todos must be an array');
    }

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

        if (todo.notes && typeof todo.notes !== 'string') {
            throw new Error(`Invalid todo at index ${index}: notes must be a string`);
        }
        if (todo.notes && todo.notes.length > 50000) {
            throw new Error(`Invalid todo at index ${index}: notes too long (max 50000 chars)`);
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

    // Only enable DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
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
