# Token Count Status

This VS Code extension shows the token count for the active editor in the status bar.

It supports OpenAI-family models through `js-tiktoken` and Claude models through Anthropic's local tokenizer package.

## Settings

- `tokenCountStatus.model`: chooses which model tokenizer to use.
- `tokenCountStatus.showForAllFiles`: when `false`, only shows counts for agent-oriented markdown files such as `AGENTS.md` and `CLAUDE.md`.

## Development

```bash
npm install
npm run compile
```

Open this `vscode` folder in VS Code and launch the extension host with `F5`.
