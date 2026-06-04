# Morse Trainer tasks. Run `just` to list recipes.

# Build a single self-contained docs/index.html for GitHub Pages.
build:
    bun run build.ts

# Serve the built site at http://localhost:3000 (rebuilds first).
serve: build
    python3 -m http.server -d docs 3000

# Run the test suite.
test:
    bun test

# Install dependencies.
install:
    bun install
