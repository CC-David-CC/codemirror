# CodeMirror 6 system tool

This is a lazily loaded, browser-local system capability. It has no desktop
window. Applications call `await host.tools.loadCodeMirror()` and then
`createEditor({parent, text, wrap, path, onChange, onSelection})`. Each call
creates an independent CodeMirror view, document, selection and undo history, and exposes indexed position and line lookups;
the consumer calls `destroy()` when its window closes. Loading after the
consumer has been disposed must not create a view. Text demonstrates the file
service and lifecycle integration.

The tool uses its own pinned dependencies and detects Python, JavaScript/TypeScript, C/C++ and Arduino `.ino` extensions for syntax highlighting. C-family files use the pinned [CodeMirror C++ language package](https://code.haverbeke.berlin/codemirror/lang-cpp). Changing a saved file path reconfigures the language without replacing the document or its history. The Text app provides the
search/replace UI and file operations. Voice insertion uses a transaction on the
active editor rather than editing CodeMirror's DOM directly.

JupyterLite is a separately bundled application with its own CodeMirror copy
and JupyterLab editor integration. These are independent runtimes and do not
share mutable editor state or package objects. Consolidation would require a
compatible JupyterLab build/extension strategy; duplication is intentional.

For broad literal searches the tool limits its stored match list; its directional
lookup can still find occurrences beyond that list without storing every match.
