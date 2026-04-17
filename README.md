# Token Count

This repository currently contains a VS Code extension that shows token counts for the active file in the status bar.

## VS Code Extension

The extension lives in [vscode](/Users/priyatham/Developer/token-count/vscode).

### Features

- Shows the token count for the active editor in the bottom status bar.
- Supports OpenAI-family models through `js-tiktoken`.
- Supports Anthropic Claude models through `@anthropic-ai/tokenizer`.
- Can be configured to show counts for all files or only common agent-oriented markdown files such as `AGENTS.md` and `CLAUDE.md`.

### Anthropic Note

Anthropic model support uses `@anthropic-ai/tokenizer` for local counting. That package appears to be outdated relative to Anthropic's current model lineup, so Claude token counts shown by this extension should be treated as best effort rather than authoritative.

### Settings

- `tokenCountStatus.model`: selects the tokenizer/model family used for counting.
- `tokenCountStatus.showForAllFiles`: when `false`, only shows counts for agent-oriented markdown files.

### Local Development

```bash
cd vscode
npm install
npm run compile
```

Open the `vscode` folder in VS Code and press `F5` to launch an Extension Development Host.
