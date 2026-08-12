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

You do not normally set this. The CLI ships a default URL purely to make its first request; the
gateway that accepts your key then reports its own canonical URL, and the CLI remembers it with the
credential. Moving the gateway to a new host therefore does not strand installed CLIs on a stale
address — they pick up the new one on the next run.

`OPVIERA_GATEWAY_URL` overrides that for self-hosted deployments and for bootstrapping a key that
belongs to a non-production environment (include the `/gateway` mount, e.g.
`https://gateway.example.com/gateway`). An explicit setting always wins over discovery. It selects
_which_ Opviera gateway to use; it is not a way to reach a non-Opviera provider.

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
