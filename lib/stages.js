// Single source of truth for the task stage pipeline, in display order.
// Loaded as a plain script by the renderer (defines window.STAGES) and via
// require() by the main process and unit tests.
(function (global) {
    const STAGES = ['brainstorm', 'planning', 'development', 'refinement', 'testing', 'done'];

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { STAGES };
    } else {
        global.STAGES = STAGES;
    }
})(this);
