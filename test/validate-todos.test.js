const { test } = require('node:test');
const assert = require('node:assert');
const { validateTodos } = require('../lib/validate-todos');

function makeTodo(overrides = {}) {
    return { text: 'Buy milk', completed: false, ...overrides };
}

test('accepts a minimal valid todo', () => {
    assert.strictEqual(validateTodos([makeTodo()]), true);
});

test('accepts a todo with all optional fields', () => {
    const todo = makeTodo({
        id: 'abc-123',
        notes: 'some notes',
        priority: 'high',
        inProgress: true,
        createdAt: Date.now(),
        subtasks: [],
        stage: 'planning',
        deletedAt: null,
        order: 3,
        brainstormResult: '# Plan',
        actionItems: [{ text: 'step 1', children: [{ text: 'sub-step' }] }],
        manualActionItems: []
    });
    assert.strictEqual(validateTodos([todo]), true);
});

test('rejects non-array input', () => {
    assert.throws(() => validateTodos({}), /must be an array/);
});

test('rejects more than 10000 todos', () => {
    const todos = new Array(10001).fill(makeTodo());
    assert.throws(() => validateTodos(todos), /Too many todos/);
});

test('rejects a todo without text', () => {
    assert.throws(() => validateTodos([{ completed: false }]), /text must be a string/);
});

test('rejects empty text', () => {
    assert.throws(() => validateTodos([makeTodo({ text: '   ' })]), /text cannot be empty/);
});

test('rejects text over 10000 chars', () => {
    assert.throws(() => validateTodos([makeTodo({ text: 'x'.repeat(10001) })]), /text too long/);
});

test('rejects non-boolean completed', () => {
    assert.throws(() => validateTodos([makeTodo({ completed: 'yes' })]), /completed must be a boolean/);
});

test('rejects invalid priority', () => {
    assert.throws(() => validateTodos([makeTodo({ priority: 'urgent' })]), /priority must be one of/);
});

test('rejects invalid stage', () => {
    assert.throws(() => validateTodos([makeTodo({ stage: 'shipping' })]), /stage must be one of/);
});

test('rejects invalid createdAt', () => {
    assert.throws(() => validateTodos([makeTodo({ createdAt: 'yesterday' })]), /createdAt must be a valid timestamp/);
    assert.throws(() => validateTodos([makeTodo({ createdAt: -5 })]), /createdAt must be a valid timestamp/);
});

test('rejects unexpected properties (prototype pollution guard)', () => {
    assert.throws(() => validateTodos([makeTodo({ constructor: {} })]), /unexpected property/);
    assert.throws(() => validateTodos([makeTodo({ evil: true })]), /unexpected property 'evil'/);
});

test('rejects action item children over the limit', () => {
    const children = new Array(51).fill({ text: 'c' });
    const todo = makeTodo({ actionItems: [{ text: 'step', children }] });
    assert.throws(() => validateTodos([todo]), /too many children/);
});

test('rejects action item child without text', () => {
    const todo = makeTodo({ actionItems: [{ text: 'step', children: [{}] }] });
    assert.throws(() => validateTodos([todo]), /text must be a string/);
});
