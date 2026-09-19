# Contributing

Thanks for looking into cybertools. It is a beta: tools may misbehave and the
interface is still rough in places, so issues are genuinely useful — do not
hesitate to open one.

A few pointers before opening an issue or a pull request.

## One rule above all: `vendor/` is never modified

CyberChef and IT-Tools are cloned into `vendor/` and are **never** modified: that
is what makes following their updates possible. Every adaptation happens in our
own code — and, to change how one of their files behaves, through an override in
`src/overrides/` (see
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#overriding-an-it-tools-file)).

A fix that belongs to a tool itself (a wrong result in an IT-Tools tool, a
CyberChef operation) should go **to them**: it will land here at the next
upstream update.

## Before opening a pull request

```bash
npm run vendor:sync-deps -- --check   # package.json still aligned with IT-Tools
npm run build                          # types and full build
npm run dev                            # then the scenarios your change touches
npm run screenshot -- build/scenarios/shell.json
```

The scenarios drive a real Chrome and check both the rendering and the computed
result; the list is in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#verification-in-a-real-browser). A
change in behaviour deserves its own scenario.

## Style

- The interface ships in English and French; user-facing strings go through
  `src/locales/` (both files).
- Code, comments and commit messages are in French — the project's working
  language. Issues and pull requests are welcome in English or French.
- A comment explains **why**, not what the code already says.

## Issues

Describe what you expected, what happened, and how to reproduce it: browser,
tool involved, and if possible the recipe link (it contains the recipe, never
your data — unless you choose to include the input).
