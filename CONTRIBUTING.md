# Contributing

Thank you for looking. Scootch is free and open source (MIT), and issues and ideas are welcome.

## How this repo is made

Scootch is developed inside a larger design system, and this repo is written out from there by a script
each time it is released. So the files here are replaced as a whole on every release, and a change made
only here would be lost.

- **Found a bug or have an idea?** Open an issue. That is the best way to get it in.
- **Want to send a fix?** A pull request is welcome as a way to show the change. It is applied at the
  source and comes back here with the next release, with credit to you, so it is closed, not merged.
- `src/system/` holds the pieces of the design system Scootch uses, copied in. They carry a "don't edit
  this copy" note for the same reason.

## Building it

```bash
npm install
npm run build
```

That compiles `src/` into `dist/`, which is what goes to npm.
