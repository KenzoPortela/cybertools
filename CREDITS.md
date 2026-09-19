# Credits and licenses

cybertools is not an original project: it is a unified interface placed on top of
two existing free software toolboxes. All the credit for the tooling itself goes
to their authors.

## CyberChef

- Author: GCHQ — <https://github.com/gchq/CyberChef>
- Copyright: Crown Copyright 2016
- License: Apache License 2.0

CyberChef's engine (`src/core`) is consumed from `vendor/cyberchef`, without
modifying its sources. We only adapt its build configuration, in `build/`, and
build our own interface on top.

The full text of the Apache 2.0 license is in `vendor/cyberchef/LICENSE` after
`npm run vendor:setup`, and at <https://www.apache.org/licenses/LICENSE-2.0>.

## IT-Tools

- Author: Corentin Thomasset — <https://github.com/CorentinTh/it-tools>
- License: GNU General Public License v3.0

IT-Tools' tool components are imported from `vendor/it-tools`, without copying or
modifying their sources. We replace the application shell — layout, home page,
search, theme — and override a few design-system components in
`src/overrides/it-tools`, leaving the originals untouched.

## cybertools' license

**GPL-3.0-only**, see `LICENSE`.

Not an aesthetic choice but an obligation: IT-Tools is under GPL-3.0, and any
work reusing its code must be distributed under the same license. CyberChef's
Apache 2.0 license is compatible in that direction — Apache 2.0 code can be
included in a GPLv3 work, the reverse is not true.

In practice, if you distribute cybertools or a Docker image embedding it, you
must provide the corresponding source code. Self-hosting it for yourself is not
distribution and triggers no obligation. GPLv3 has no network clause: exposing
the site publicly does not change this.

## Changes made to the upstream sources

None. Both repositories in `vendor/` are used as-is, and `git status` stays empty
there: everything our scripts generate inside them is already covered by their
own `.gitignore`. The adaptations live in our code — build configuration,
component overrides, catalogue layer.
