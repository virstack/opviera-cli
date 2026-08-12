# Opviera CLI

An agentic coding tool for your terminal, wired to the Opviera platform.

Opviera CLI runs against your organisation's Opviera gateway and nothing else. Your administrator
issues you an API key; the CLI validates it, scopes your work to a project, and every request is
metered against your organisation's quotas and budgets. There is no separate model subscription to
manage and no way to route work somewhere unbilled.

## Getting started

1. Get an Opviera API key (`vsk_…`) and your project name from your administrator.
2. Run `opviera` in your project directory.
3. Enter the project name and your key when prompted. The key is validated against the gateway
   before the agent starts, and stored in `~/.local/share/opviera/auth.json` with `0600`
   permissions so you only do this once.

```
$ opviera
```

### Non-interactive use

For CI and containers, set the credential in the environment instead. It is validated exactly the
same way — this supplies the key, it does not skip the check.

```
export OPVIERA_API_KEY=vsk_…
export OPVIERA_PROJECT_ID=your-project   # required if your key's policy restricts projects
```

### Which gateway a key talks to

Nothing to configure, and nothing you _can_ configure. Keys carry the environment that issued
them — a QA key looks like `vsk_qa_…` — and the CLI derives the console for that environment from
the key itself (`vsk_qa_…` → `qa-console.opviera.ai`, an unmarked production key →
`console.opviera.ai`). If a key is presented to the wrong deployment, the gateway says so by name
rather than reporting an invalid key.

There is deliberately no environment variable to override this. A client that could repoint the
CLI could route an organisation's traffic, and its keys, somewhere the operator does not control —
which is the whole reason this fork compiles a single provider in. A self-hosted Enterprise
deployment gets a build with its own zone compiled in instead.

### Signing in more than once

Credentials are stored per directory, under `~/.local/share/opviera/auth/`, mode `0600`. Running
the CLI in a different project signs in separately, so one machine can hold keys for several
projects — or several organisations — without one of them quietly billing work to another.
`opviera login` and `opviera logout` act on the current directory and say which one.

## Configuration

Project configuration lives in `opviera.json` (or `opviera.jsonc`) in your project directory, with
global defaults in `~/.config/opviera/`.

## Credits

Opviera CLI is built on [opencode](https://github.com/anomalyco/opencode), an open-source AI coding
agent, used under the MIT licence. It is an independent derivative work: it is not affiliated with,
endorsed by, or supported by the opencode project. Please report Opviera issues to Virstack, not
upstream.

## Licence

MIT — see [LICENSE](./LICENSE), which retains the upstream opencode copyright notice.
