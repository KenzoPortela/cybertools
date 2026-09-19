# Security

## Reporting a vulnerability

Please do not open a public issue. Write to **portelakenzo@gmail.com** with
enough detail to reproduce the problem. You will get an answer within a week.

## What cybertools guarantees

- **No data you type leaves the browser.** There is no application server: nginx
  only serves static files. The Content Security Policy served by the image
  forbids the browser any outgoing connection (`connect-src 'self'`), and
  `Referrer-Policy: no-referrer` avoids leaking the address of a shared page.
- **Operations that would contact a third party are excluded**: *HTTP request*,
  *DNS over HTTPS* and *Show on map* are not in the catalogue.
- **What is stored locally** (favourites, recent tools, settings, last recipe)
  stays in your browser's `localStorage` and can be erased from the Settings
  page. Inputs typed into the tools are never saved.
- **A shared recipe link** contains the recipe; it only includes the input if you
  explicitly tick that option when sharing.

## Scope

Vulnerabilities in the tools themselves belong to their own projects
([CyberChef](https://github.com/gchq/CyberChef/security),
[IT-Tools](https://github.com/CorentinTh/it-tools/security)). Report them here
only if they come from our integration.
