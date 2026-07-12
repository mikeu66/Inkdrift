// Parse an AI response that should be a JSON array.
// Handles markdown code fences and local models that wrap the array in an object.
// Loaded as a plain script by the renderer (defines window.parseJsonArrayResponse)
// and via require() by the unit tests.
(function (global) {
    function parseJsonArrayResponse(text) {
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch {
            // Fall back to the outermost array in the text
            const start = jsonText.indexOf('[');
            const end = jsonText.lastIndexOf(']');
            if (start === -1 || end <= start) {
                throw new Error('AI response was not valid JSON');
            }
            parsed = JSON.parse(jsonText.slice(start, end + 1));
        }

        let items = null;
        if (Array.isArray(parsed)) {
            items = parsed;
        } else if (parsed && typeof parsed === 'object') {
            items = Object.values(parsed).find(v => Array.isArray(v)) || null;
        }
        if (!items) {
            throw new Error('AI response did not contain a JSON array');
        }

        // Drop items without usable text so one bad entry can't break saving
        items = items.filter(item => item && typeof item.text === 'string' && item.text.trim().length > 0);
        if (items.length === 0) {
            throw new Error('AI response contained no usable items');
        }
        return items;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { parseJsonArrayResponse };
    } else {
        global.parseJsonArrayResponse = parseJsonArrayResponse;
    }
})(this);
