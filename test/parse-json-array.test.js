const { test } = require('node:test');
const assert = require('node:assert');
const { parseJsonArrayResponse } = require('../lib/parse-json-array');

test('parses a plain JSON array', () => {
    const items = parseJsonArrayResponse('[{"text": "Task A", "hoursNeeded": 2}]');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].text, 'Task A');
});

test('strips markdown code fences', () => {
    const items = parseJsonArrayResponse('```json\n[{"text": "Task A"}]\n```');
    assert.strictEqual(items[0].text, 'Task A');
});

test('extracts the array from surrounding prose', () => {
    const items = parseJsonArrayResponse('Here is your plan: [{"text": "Task A"}] Hope that helps!');
    assert.strictEqual(items[0].text, 'Task A');
});

test('unwraps an object-wrapped array (small local models)', () => {
    const items = parseJsonArrayResponse('{"items": [{"text": "Task A"}]}');
    assert.strictEqual(items[0].text, 'Task A');
});

test('filters out items without usable text', () => {
    const items = parseJsonArrayResponse('[{"text": "Keep"}, {"text": "  "}, {"hoursNeeded": 1}, null]');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].text, 'Keep');
});

test('throws when no items are usable', () => {
    assert.throws(() => parseJsonArrayResponse('[{"hoursNeeded": 1}]'), /no usable items/);
});

test('throws on a JSON object with no array inside', () => {
    assert.throws(() => parseJsonArrayResponse('{"text": "not an array"}'), /did not contain a JSON array/);
});

test('throws on non-JSON text', () => {
    assert.throws(() => parseJsonArrayResponse('Sorry, I cannot help with that.'), /not valid JSON/);
});
