// Validate todos data structure before it is written to or read from disk.
// Extracted from main.js so it can be unit tested outside Electron.

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

module.exports = { validateTodos };
