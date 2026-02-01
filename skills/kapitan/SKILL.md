---
name: kapitan
description:
  Operate Kapitan configuration management projects. Use when compiling targets,
  managing inventory/classes, handling refs/secrets, fetching dependencies, or
  troubleshooting Kapitan errors.
---

# Kapitan Guide

Kapitan generates configuration files (Kubernetes, Terraform, etc.) by combining
a hierarchical inventory with templating engines (jsonnet, jinja2, kadet/Python,
helm, kustomize).

## Project Structure

```
project/
├── .kapitan                    # Version/defaults config
├── inventory/
│   ├── targets/                # What to compile (one YAML per target)
│   └── classes/                # Reusable configuration
├── components/                 # Kadet (Python) components
├── templates/                  # Jsonnet/Jinja2 templates
├── lib/                        # Shared libraries, custom filters
├── refs/                       # Encrypted secrets
└── compiled/                   # Generated output (gitignore)
```

## Essential Commands

```bash
# Compile
kapitan compile                          # All targets
kapitan compile -t <target>              # Specific target(s)
kapitan compile -l env=prod              # By labels
kapitan compile --fetch                  # Fetch dependencies first
kapitan compile --force-fetch            # Force re-fetch
kapitan compile --reveal                 # Decrypt refs in output
kapitan compile -v                       # Verbose/debug

# Inventory
kapitan inventory -t <target>            # Show merged inventory
kapitan inventory -t <target> --flat     # Flattened view
kapitan inventory -t <target> -p parameters.app.name  # Specific path
kapitan searchvar parameters.app.name    # Find variable declarations

# Refs (secrets)
kapitan refs --write gpg:path/secret -f file.txt           # From file
echo "secret" | kapitan refs --write gpg:path/secret -f -  # From stdin
kapitan refs --write gpg:path/secret -t <target> -f -      # With target recipients
kapitan refs --reveal --tag '?{gpg:path/secret}'           # Reveal single ref
kapitan refs --reveal -f compiled/target/file.yml          # Reveal file

# Other
kapitan lint                             # Validate inventory
kapitan eval file.jsonnet --output yaml  # Test jsonnet
kapitan init --directory ./new-project   # Initialize project
```

## Inventory

### Targets (`inventory/targets/*.yml`)

```yaml
classes:
  - common # → classes/common.yml
  - components.app # → classes/components/app.yml

parameters:
  target_name: ${_reclass_:name:short} # Auto from filename
  app:
    replicas: 3
    image: myapp:v1.0.0

  kapitan:
    vars:
      target: ${target_name}
      namespace: ${target_name}
    labels:
      env: prod
    compile:
      - input_type: jsonnet
        input_paths: [templates/main.jsonnet]
        output_path: manifests
        output_type: yaml
    dependencies:
      - type: git
        source: https://github.com/org/repo.git
        ref: main
        output_path: vendor/repo
```

Target naming: `inventory/targets/teams/platform/app.yml` → target
`teams.platform.app` (with `--compose-target-name`)

### Classes (`inventory/classes/*.yml`)

```yaml
classes:
  - defaults.kubernetes # Can inherit other classes

parameters:
  namespace: ${target_name}
  app:
    name: myapp
  service_name: ${app:name}-svc # Nested access with colon
```

### Interpolation

- `${variable}` - Simple reference
- `${nested:key}` - Nested access (colon separator)
- `${_reclass_:name:short}` - Target filename without extension

## Input Types

### Jsonnet

```yaml
compile:
  - input_type: jsonnet
    input_paths: [templates/main.jsonnet]
    output_path: manifests
    output_type: yaml # yaml|json|plain
    prune: false # Remove null/empty
```

```jsonnet
local kap = import "lib/kapitan.libjsonnet";
local inv = kap.inventory();
{ deployment: { replicas: inv.parameters.app.replicas } }
```

### Kadet (Python)

```yaml
compile:
  - input_type: kadet
    input_paths: [components/app]
    output_path: manifests
    input_params: { namespace: ops }
```

```python
# components/app/__init__.py
from kapitan.inputs import kadet
inv = kadet.inventory()

def main(input_params=None):
    return {"deployment": {"name": inv.parameters.app.name}}
```

### Jinja2

```yaml
compile:
  - input_type: jinja2
    input_paths: [templates/]
    output_path: scripts
    suffix_remove: true
    suffix_stripped: .j2
```

Context: `inventory`, `inventory_global`, `input_params`, all `kapitan.vars`

### Helm

```yaml
compile:
  - input_type: helm
    input_paths: [charts/nginx]
    output_path: manifests
    helm_params: { name: my-release, namespace: default }
    helm_values: { replicaCount: 3 }
```

### Copy

```yaml
compile:
  - input_type: copy
    input_paths: [scripts/*.sh]
    output_path: scripts
```

## Dependencies

```yaml
parameters:
  kapitan:
    dependencies:
      - type: git
        source: https://github.com/org/repo.git
        ref: v1.0.0
        subdir: templates # Optional subdirectory
        output_path: vendor/repo

      - type: helm
        source: https://charts.bitnami.com/bitnami
        chart_name: nginx
        version: 15.0.0
        output_path: charts/nginx

      - type: https
        source: https://example.com/file.tar.gz
        output_path: vendor/file
        unpack: true
```

## Refs (Secrets)

### Backends

| Type           | Usage                       |
| -------------- | --------------------------- |
| `plain`        | No encryption (base64 only) |
| `gpg`          | GPG encrypted               |
| `gkms`         | Google Cloud KMS            |
| `awskms`       | AWS KMS                     |
| `azkms`        | Azure Key Vault             |
| `vaultkv`      | HashiCorp Vault KV          |
| `vaulttransit` | Vault Transit               |

### In Inventory

```yaml
parameters:
  db:
    password: ?{gpg:targets/${target_name}/db_pass}
    cert: ?{gpg:tls/cert@data.cert} # Sub-variable access
    token: ?{gpg:api/token||random:str:32} # Auto-generate if missing
```

### Functions (after `||`)

- `random:str:N` / `random:alpha:N` - Random strings
- `rsa:N` / `ecdsa:N` / `ed25519` / `ssh:N` - Key pairs
- `base64` - Base64 encode

### GPG Recipients

```yaml
parameters:
  kapitan:
    secrets:
      gpg:
        recipients:
          - fingerprint: D9234C61F58BEB3ED8552A57E28DC07A3CBFAE7C
```

## Configuration (`.kapitan`)

```yaml
version: 0.35.0

compile:
  search-paths: [lib, vendor]
  inventory-path: ./inventory
  refs-path: ./refs
  parallelism: 4

inventory:
  inventory-path: ./inventory
```

## Inventory Backends

```bash
kapitan compile --inventory-backend=reclass      # Default
kapitan compile --inventory-backend=reclass-rs   # Faster (pip install reclass-rs)
kapitan compile --inventory-backend=omegaconf    # Alternative syntax
```

## Troubleshooting

| Error                 | Solution                                                    |
| --------------------- | ----------------------------------------------------------- |
| Class not found       | Check path: `components.app` → `classes/components/app.yml` |
| No targets found      | Verify files in `inventory/targets/` with `.yml` extension  |
| Jsonnet import error  | Add to search paths: `-J lib -J vendor` or in `.kapitan`    |
| Ref not found         | Create with `kapitan refs --write`, check `--refs-path`     |
| Helm binary not found | Install helm, ensure in PATH                                |
| Slow compilation      | Use `--inventory-backend=reclass-rs`, limit with `-t`       |

Clear cache: `rm -rf .kapitan_cache .dependency_cache`

## Jsonnet Helpers

```jsonnet
local kap = import "lib/kapitan.libjsonnet";
local inv = kap.inventory();              // Current target inventory
local global = kap.inventory_global();    // All targets
local tpl = kap.jinja2_template("t.j2", {key: "val"});
local data = kap.yaml_load("file.yaml");
local content = kap.file_read("file.txt");
local exists = kap.file_exists("file.txt");
local files = kap.dir_files_list("dir/");
```

## Best Practices

1. **Classes for reuse** - Targets should be thin, importing classes
2. **Labels for filtering** - Use `-l env=prod` for partial compiles
3. **Gitignore generated files** - `compiled/`, `.kapitan_cache/`,
   `.dependency_cache/`
4. **Never commit plaintext secrets** - Use refs with encryption backends
5. **Pin versions** - In `.kapitan` and dependency refs
6. **Use `refs` not `secrets`** - `secrets` command is deprecated
