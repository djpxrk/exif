#!/bin/sh
# Builds the site and publishes dist/ to the gh-pages branch, which GitHub
# Pages serves ("Deploy from a branch"). Run with: npm run deploy
set -e
cd "$(dirname "$0")/.."
npm run build
remote="$(git remote get-url origin)"
name="$(git config user.name)"
email="$(git config user.email)"
rev="$(git rev-parse --short HEAD)"
cd dist
touch .nojekyll   # serve files as-is; skip Jekyll processing
git init -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m "Deploy $rev"
git push -q -f "$remote" gh-pages
rm -rf .git
echo "Published $rev to gh-pages. GitHub Pages updates within a minute or two."
