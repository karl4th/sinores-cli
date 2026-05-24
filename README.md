<p align="center">
  <img src="https://sinores.net/icon.png" alt="Sinores" width="20%" />
</p>

<h1 align="center">sinores-cli</h1>

<p align="center">
  Terminal AI agent for code operations via Moonshot API.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sinores-cli"><img src="https://img.shields.io/npm/v/sinores-cli?style=flat-square&color=8B5CF6" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/sinores-cli"><img src="https://img.shields.io/npm/dm/sinores-cli?style=flat-square&color=8B5CF6" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-8B5CF6?style=flat-square" alt="Node.js >= 18">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-8B5CF6?style=flat-square" alt="license: MIT"></a>
</p>

---

## Features

- Terminal-native interface. No browser context switching.
- File-system operations with explicit permission model keyed by `tool:path`.
- Persistent sessions stored in `~/.sinores/sessions/`.
- Session resume and export to Markdown.
- Auto-truncation of history near context limits.
- `@<query>` inline file picker for attaching local files as context.
- Live reasoning and content streaming.

## Requirements

- Node.js >= 18
- ESM (`"type": "module"`)
- Moonshot API key

## Installation

```bash
npm install -g sinores-cli
```

Then run:

```bash
sinores
```

## Configuration

The CLI reads config from `~/.sinores/config.json` (created automatically on first run, or via `--init-config`).

### Quick start

```bash
sinores --init-config
```

Then edit `~/.sinores/config.json`:

```json
{
  "moonshotApiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "defaultModel": "kimi-k2.6",
  "maxRounds": 50
}
```

### Priority

1. `MOONSHOT_API_KEY` environment variable
2. `moonshotApiKey` in `~/.sinores/config.json`
3. `.env` file in the working directory (backward compat)

This means you can keep the key in `config.json` globally, but override per-project via `.env` or env var.

## Usage

Start a new session:

```bash
sinores
```

Resume a previous session:

```bash
sinores --resume
```

## Sessions

Conversations are auto-saved to `~/.sinores/sessions/`. Use `--resume` on startup or `/resume` in the prompt to restore a previous session. Use `/new` to discard the current session and start a new one. Use `/export` to write the current session to a Markdown file in the current working directory.

History is truncated automatically when approaching the model's context limit.

## Permission Model

Every file write, edit, delete, or shell command requires explicit approval. Approvals are scoped to the current session and keyed by `tool:path`. An approval granted for one operation does not extend to other paths or subsequent sessions.

## Commands

### Slash Commands

| Command | Action |
|---------|--------|
| `/goal <description>` | Set a goal, plan it, then execute step by step |
| `/init` | Scan project tree and generate `.sinores/SINORES.md` context file |
| `/help` | Show available commands |
| `/mode <mode>` | Switch mode: `chat`, `agent`, `code`, `research` |
| `/export` | Save current session to Markdown in CWD |
| `/resume` | Browse and restore a previous session |
| `/new` | Start a new session |
| `/clear` | Reset the conversation (requires double confirmation) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate input history |
| `Tab` | Autocomplete commands; cycle hints when empty |
| `Ctrl+C` | Exit (press twice when idle) |
| `Esc` | Abort a running agent |
| `@<query>` | Inline file picker for attaching context |

### Goal Mode Keys

When reviewing or executing a goal plan:

| Key | Action |
|-----|--------|
| `Enter` | Approve plan / continue to next step |
| `E` | Refine plan with LLM |
| `R` | Regenerate plan |
| `Esc` | Cancel goal execution |

## Development

```bash
npm run dev              # tsx watch mode
npm run dev -- --resume  # dev mode with session picker
npm run build            # compile TypeScript to dist/
npm start                # run compiled build
npm start -- --resume    # compiled build with session picker
npm test                 # run test suite
```

## License

MIT
