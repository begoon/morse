# Morse Trainer tasks. Run `just` to list recipes.

# Build the static site into docs/ for GitHub Pages (and local serving).
build:
    rm -rf docs
    bun build ./index.html --outdir docs --minify

# Serve the built site at http://localhost:3000 (rebuilds first).
serve: build
    python3 -m http.server -d docs 3000

# Run the test suite.
test:
    bun test

# Install dependencies.
install:
    bun install
