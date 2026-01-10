export interface ElectronAPI {
  saveTodos: (todos: any[]) => Promise<{ success: boolean }>;
  loadTodos: () => Promise<any[]>;
  exportTodos: (todos: any[]) => Promise<{ success: boolean; cancelled?: boolean; filePath?: string; error?: string }>;
  importTodos: () => Promise<{ success: boolean; cancelled?: boolean; todos?: any[]; count?: number; error?: string; errorType?: string }>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
