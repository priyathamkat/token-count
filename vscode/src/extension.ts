import * as path from "node:path";
import * as vscode from "vscode";
import {
  encodingForModel,
  getEncoding,
  getEncodingNameForModel,
  Tiktoken,
  TiktokenEncoding,
  TiktokenModel
} from "js-tiktoken";

const CONFIG_NAMESPACE = "tokenCountStatus";
const STATUS_COMMAND = "tokenCountStatus.showInfo";

const AGENT_MARKDOWN_BASENAMES = new Set([
  "agents.md",
  "claude.md",
  "gemini.md",
  "copilot-instructions.md",
  "ai-instructions.md",
  "system.md",
  "prompt.md"
]);

const MODEL_PREFIX_TO_ENCODING: Array<[prefix: string, encoding: TiktokenEncoding]> = [
  ["gpt-5", "o200k_base"],
  ["gpt-4.1", "o200k_base"],
  ["gpt-4o", "o200k_base"],
  ["o4", "o200k_base"],
  ["o3", "o200k_base"],
  ["gpt-4-turbo", "cl100k_base"],
  ["gpt-4", "cl100k_base"],
  ["gpt-3.5-turbo", "cl100k_base"]
];

type ExtensionConfig = {
  model: string;
  showForAllFiles: boolean;
};

let statusBarItem: vscode.StatusBarItem;
let tokenizerCache = new Map<string, { tokenizer: Tiktoken; encodingName: string }>();

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = STATUS_COMMAND;
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand(STATUS_COMMAND, async () => {
      const editor = vscode.window.activeTextEditor;
      const config = getConfig();

      if (!editor) {
        void vscode.window.showInformationMessage("No active editor.");
        return;
      }

      const info = getTokenCount(editor.document, config);
      const filename = path.basename(editor.document.fileName) || editor.document.uri.toString();

      if (!info.visible) {
        const scopeDescription = config.showForAllFiles
          ? "all files"
          : "agent-oriented markdown files such as AGENTS.md and CLAUDE.md";
        void vscode.window.showInformationMessage(
          `Token Count Status is hidden for ${filename}. Current scope: ${scopeDescription}.`
        );
        return;
      }

      if (info.count === undefined) {
        void vscode.window.showWarningMessage(
          `Token Count Status could not count tokens for ${filename}: ${info.message ?? "unknown error"}`
        );
        return;
      }

      void vscode.window.showInformationMessage(
        `${filename}: ${formatNumber(info.count)} tokens using ${config.model} (${info.encodingName}).`
      );
    }),
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeDocument = vscode.window.activeTextEditor?.document;
      if (activeDocument && event.document === activeDocument) {
        updateStatusBar();
      }
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document === vscode.window.activeTextEditor?.document) {
        updateStatusBar();
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document === vscode.window.activeTextEditor?.document) {
        updateStatusBar();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_NAMESPACE)) {
        updateStatusBar();
      }
    })
  );

  context.subscriptions.push({
    dispose: () => {
      tokenizerCache.clear();
    }
  });

  updateStatusBar();
}

export function deactivate(): void {
  tokenizerCache.clear();
}

function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    statusBarItem.hide();
    return;
  }

  const info = getTokenCount(editor.document, getConfig());

  if (!info.visible) {
    statusBarItem.hide();
    return;
  }

  if (info.count === undefined) {
    statusBarItem.text = "$(warning) Tokens: --";
    statusBarItem.tooltip = info.message ?? "Unable to count tokens.";
    statusBarItem.show();
    return;
  }

  statusBarItem.text = `$(symbol-number) Tokens: ${formatNumber(info.count)}`;
  statusBarItem.tooltip = [
    `Model: ${info.model}`,
    `Encoding: ${info.encodingName}`,
    `File: ${editor.document.fileName}`
  ].join("\n");
  statusBarItem.show();
}

function getTokenCount(document: vscode.TextDocument, config: ExtensionConfig): {
  visible: boolean;
  count?: number;
  encodingName?: string;
  model: string;
  message?: string;
} {
  if (!shouldShowForDocument(document, config)) {
    return {
      visible: false,
      model: config.model
    };
  }

  try {
    const { tokenizer, encodingName } = getTokenizer(config.model);
    return {
      visible: true,
      count: tokenizer.encode(document.getText()).length,
      encodingName,
      model: config.model
    };
  } catch (error) {
    return {
      visible: true,
      model: config.model,
      message: error instanceof Error ? error.message : "Unknown tokenizer error."
    };
  }
}

function shouldShowForDocument(document: vscode.TextDocument, config: ExtensionConfig): boolean {
  if (document.isUntitled || document.uri.scheme !== "file") {
    return config.showForAllFiles;
  }

  if (config.showForAllFiles) {
    return true;
  }

  if (document.languageId !== "markdown") {
    return false;
  }

  return AGENT_MARKDOWN_BASENAMES.has(path.basename(document.fileName).toLowerCase());
}

function getTokenizer(model: string): { tokenizer: Tiktoken; encodingName: string } {
  const normalizedModel = model.trim();
  const cached = tokenizerCache.get(normalizedModel);
  if (cached) {
    return cached;
  }

  try {
    const knownModel = normalizedModel as TiktokenModel;
    const tokenizer = encodingForModel(knownModel);
    const resolved = {
      tokenizer,
      encodingName: getEncodingNameForModel(knownModel)
    };
    tokenizerCache.set(normalizedModel, resolved);
    return resolved;
  } catch {
    const encodingName = getEncodingNameForModelFallback(normalizedModel);
    const tokenizer = getEncoding(encodingName);
    const resolved = { tokenizer, encodingName };
    tokenizerCache.set(normalizedModel, resolved);
    return resolved;
  }
}

function getEncodingNameForModelFallback(model: string): TiktokenEncoding {
  const normalizedModel = model.trim().toLowerCase();

  for (const [prefix, encoding] of MODEL_PREFIX_TO_ENCODING) {
    if (normalizedModel.startsWith(prefix)) {
      return encoding;
    }
  }

  throw new Error(
    `Unsupported model "${model}". Update the setting to a known model or extend the fallback map in the extension.`
  );
}

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  return {
    model: config.get<string>("model", "gpt-5-mini"),
    showForAllFiles: config.get<boolean>("showForAllFiles", false)
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
