<p align="center">
  <img src="https://sinores.net/icon.png" alt="Sinores" width="20%" />
</p>

<h1 align="center">sinores-cli</h1>

<p align="center">
  <strong>Autonomous terminal AI coding agent — read, write, run, ship.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sinores-cli"><img src="https://img.shields.io/npm/v/sinores-cli?style=flat-square&color=8B5CF6" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/sinores-cli"><img src="https://img.shields.io/npm/dm/sinores-cli?style=flat-square&color=8B5CF6" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-8B5CF6?style=flat-square" alt="Node.js >= 18">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-8B5CF6?style=flat-square" alt="license: MIT"></a>
</p>

---

## News

**v0.1.0** — Initial release

- Agentic file-system access with explicit permission model
- Live reasoning and content streaming
- Persistent sessions with auto-save and resume
- Session export to Markdown
- @file picker for attaching local files as context
- Smart history truncation to stay under context limits

---

## Why sinores-cli?

**Browser tabs are friction.** Every time you switch to a web UI to ask AI about your code, you break flow. sinores lives in your terminal — right where you already work.

**No copy-paste.** Ask about a file, the agent reads it. Ask to refactor, it edits in place. Ask to run tests, it executes. All without you leaving the shell.

**Trust, but verify.** Every file write, edit, delete, or shell command triggers a permission prompt. Session-scoped approvals are keyed by `tool:path`, so "allow once" means exactly that — not blanket access to your entire system.

**Pick up where you left off.** Conversations auto-save to `~/.sinores/sessions/`. Resume yesterday's debugging session with `--resume` or `/resume`.

**Stay under limits.** History auto-truncates at a safe boundary so you don't hit context ceilings mid-conversation.

---

## Installation

### Global (recommended)

```bash
npm install -g sinores-cli
```

Then run from anywhere:

```bash
sinores
```

### Local

```bash
git clone <repo-url>
cd sinores-cli
npm install
npm run build
npm link
```

### Requirements

- Node.js 18+
- API key for your configured LLM provider

---

## Commands & Shortcuts

### Slash Commands

Type at the prompt:

| Command | Action |
|---------|--------|
| `/init` | Scan project tree and generate `.sinores/SINORES.md` context file |
| `/help` | Show all available commands |
| `/model <name>` | Switch the active model |
| `/mode <mode>` | Switch mode: `chat`, `agent`, `code`, `research` |
| `/export` | Save current session to a Markdown file in CWD |
| `/resume` | Browse and restore a previous session |
| `/new` | Start a brand new session |
| `/clear` | Reset the conversation (requires double confirmation) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate input history |
| `Tab` | Autocomplete commands; cycle hints when empty |
| `Ctrl+C` | Exit (press twice when idle) |
| `Esc` | Abort a running agent |
| `@<query>` | Inline file picker for attaching context |

---

## Configuration

Create a `.env` file in your working directory:

```bash
cp .env.example .env
```

Add your API key:

```env
API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The tool reads configuration via `dotenv`, so environment variables work too:

```bash
export API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Usage

```bash
# Start a new session
sinores

# Resume a previous session
sinores --resume
```

### Development

```bash
npm run dev              # tsx watch with hot reload
npm run dev -- --resume  # dev + session picker
npm run build            # compile TypeScript
npm start                # run compiled build
npm start -- --resume    # compiled + session picker
```

---

## Connect with Us

- **Website:** [https://sinores.net](https://sinores.net)
- **GitHub:** [https://github.com/karl4th/sinores-cli](https://github.com/karl4th/sinores-cli)
- **Issues & Feature Requests:** [GitHub Issues](https://github.com/karl4th/sinores-cli/issues)
- **Discussions:** [GitHub Discussions](https://github.com/karl4th/sinores-cli/discussions)

---

## License

MIT
