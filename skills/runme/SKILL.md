---
name: runme
description:
  Create and execute runnable Markdown notebooks using Runme. Use when writing
  documentation with executable code blocks, creating runbooks, onboarding
  guides, or operational playbooks. Runme makes Markdown files executable by
  running fenced code blocks as shell commands or scripts in multiple languages.
---

# Runme - Executable Markdown Notebooks

Runme transforms Markdown files into executable notebooks. It parses fenced code
blocks and runs them as commands, supporting shell/bash, Python, JavaScript,
Ruby, and many other languages.

## Quick Reference

### Running Commands

```bash
# Interactive TUI
./runme

# List all runnable cells
./runme list --filename <file.md>

# Run a specific named cell
./runme run <cell-name> --filename <file.md>

# Run all cells
./runme run --all --filename <file.md> --skip-prompts

# Print cell content without running
./runme print <cell-name> --filename <file.md>

# Open web-based notebook UI
./runme open
```

### Key Flags

| Flag                | Description                                |
| ------------------- | ------------------------------------------ |
| `--filename <file>` | Specify Markdown file (default: README.md) |
| `--chdir <dir>`     | Change working directory                   |
| `--allow-unnamed`   | Include unnamed code blocks                |
| `--skip-prompts`    | Bypass interactive prompts                 |
| `--project <dir>`   | Set project root for discovery             |

## Writing Runme Notebooks

### Basic Code Block

A simple executable code block:

````markdown
```sh
echo "Hello, World!"
```
````

### Named Code Block (Recommended)

Name cells for CLI access and referencing:

````markdown
```sh { name=hello-world }
echo "Hello, World!"
```
````

Run with: `./runme run hello-world`

### Cell Configuration Options

Add configuration in the code fence metadata using JSON or HTML-attribute
notation:

````markdown
```sh { name=my-task interactive=false background=false cwd=./src }
echo "Configured cell"
```
````

Or JSON notation:

````markdown
```sh {"name":"my-task","interactive":"false"}
echo "Configured cell"
```
````

#### Configuration Reference

| Option                   | Default          | Description                                                        |
| ------------------------ | ---------------- | ------------------------------------------------------------------ |
| `name`                   | auto-generated   | Cell identifier for CLI reference                                  |
| `interactive`            | `true`           | Allow user input; set `false` for non-interactive output           |
| `background`             | `false`          | Run as background process (for long-running tasks)                 |
| `cwd`                    | file's directory | Working directory for execution                                    |
| `closeTerminalOnSuccess` | `true`           | Hide terminal after successful execution                           |
| `excludeFromRunAll`      | `false`          | Skip this cell during "Run All"                                    |
| `mimeType`               | auto-detect      | Output format: `text/plain`, `application/json`, `image/png`, etc. |
| `promptEnv`              | `auto`           | Prompt for env vars: `auto`, `always`/`yes`, `never`/`no`          |
| `skipPrompts`            | `false`          | Bypass all interactive prompts                                     |
| `tag`                    | empty            | Categorize cells (e.g., `tag=setup` or `tag=test`)                 |
| `terminalRows`           | `10`             | Number of output rows to display                                   |

### Document-Level Configuration (Frontmatter)

Set defaults for all cells in the document:

```markdown
---
cwd: ./src
shell: zsh
skipPrompts: true
terminalRows: 20
---

# My Runbook

Content here...
```

### Multi-Language Support

Runme auto-detects languages. Specify the language identifier:

````markdown
```python
print("Hello from Python")
```

```javascript
console.log("Hello from Node.js");
```

```ruby
puts "Hello from Ruby"
```
````

**Supported languages:** bash, sh, zsh, fish, python, javascript/js,
typescript/ts, ruby, perl, php, lua, rust, powershell

### Environment Variables

#### Prompting for Variables

Use `export` to prompt users for values:

````markdown
```sh { name=setup promptEnv=true }
export PROJECT_NAME="my-project"
export ENVIRONMENT="development"
echo "Setting up $PROJECT_NAME in $ENVIRONMENT"
```
````

#### Piping Between Cells

Reference previous cell output with `$__`:

````markdown
```sh { name=list-files }
ls -la
```

```sh { name=process-output }
echo "Previous output was:"
echo "$__"
```
````

#### Named Cell Exports

Cells named with `UPPER_SNAKE_CASE` (min 3 chars) are exported as environment
variables:

````markdown
```sh { name=GIT_BRANCH }
git branch --show-current
```

```sh { name=use-branch }
echo "Current branch: $GIT_BRANCH"
```
````

### Background Tasks

For long-running processes (dev servers, watchers):

````markdown
```sh { name=dev-server background=true }
npm run dev
```
````

### Non-Interactive Output

For cells that should display output inline (no terminal interaction):

````markdown
```sh { name=show-version interactive=false }
node --version
```
````

### JSON/Data Output

Render JSON as formatted output:

````markdown
```sh { name=get-config interactive=false mimeType=application/json }
cat config.json
```
````

### Tagging for Batch Execution

Group related cells with tags:

````markdown
```sh { name=install-deps tag=setup }
npm install
```

```sh { name=init-db tag=setup }
./scripts/init-db.sh
```

```sh { name=run-tests tag=test }
npm test
```
````

Run by tag: `./runme run --tag setup`

### Exclude from Run All

Prevent dangerous commands from running in batch:

````markdown
```sh { name=destroy-everything excludeFromRunAll=true }
terraform destroy -auto-approve
```
````

## Complete Example

Here's a full example runbook:

````markdown
---
cwd: .
shell: bash
---

# Project Setup Runbook

## Prerequisites

Install required tools:

```sh { name=install-tools tag=setup }
brew install node python3
```

## Environment Setup

Configure environment variables:

```sh { name=setup-env tag=setup promptEnv=true }
export API_KEY="your-api-key-here"
export DATABASE_URL="postgres://localhost:5432/mydb"
echo "Environment configured"
```

## Install Dependencies

```sh { name=install-deps tag=setup }
npm install
```

## Development

Start the development server:

```sh { name=dev-server background=true }
npm run dev
```

## Testing

Run the test suite:

```sh { name=run-tests tag=test interactive=false }
npm test
```

## Deployment

⚠️ **Caution**: This deploys to production!

```sh { name=deploy excludeFromRunAll=true }
npm run deploy
```
````

## Best Practices

1. **Always name important cells** - Makes them accessible via CLI
2. **Use `interactive=false`** for cells that don't need user input
3. **Use `background=true`** for dev servers and watchers
4. **Use `excludeFromRunAll=true`** for destructive commands
5. **Use tags** to group related cells (setup, test, deploy)
6. **Use environment variable prompts** for parameterized runbooks
7. **Use frontmatter** for document-wide settings
8. **Keep cell names lowercase with hyphens** (e.g., `install-deps`,
   `run-tests`)

## File Extensions

Runme recognizes these extensions:

- `.md` - Standard Markdown
- `.mdx` - Markdown with JSX
- `.mdi` - Markdown Interactive
- `.mdr` - Markdown Runnable
- `.runme` - Explicit Runme Notebook

## DotEnv Support

Runme automatically loads `.env` and `.env.local` files from the project root.
Control loading order with:

```bash
./runme run <name> --env-order .env.local,.env,.env.production
```

## Troubleshooting

### Cell not appearing in list

- Ensure the code block has a language identifier (e.g., `sh`, `bash`)
- Check that `ignore=true` is not set
- For unnamed cells, use `--allow-unnamed` flag

### Environment variables not persisting

- Variables persist within a session
- Use named cells with `UPPER_SNAKE_CASE` for cross-cell access
- Check that the cell executed successfully

### Background task not running

- `background=true` requires `interactive=true` (default)
- Ensure the command doesn't exit immediately
