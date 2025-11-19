#!/bin/bash

set -e

version="$1"

echo "Releasing to $version branch..."

rm -rf dist

set -x
npm install
npm run build
npm run lint
npm test
npm prune --production

rm -rf .release
mkdir -p .release

cp action.yml action-types.yml package.json package-lock.json .release/
rsync -R -v dist/src/*.js .release/
rsync -R -v dist/src/**/*.js .release/
cp -R node_modules .release/node_modules

#git checkout -b "$version"
rm -rf node_modules  # remove node_modules/.cache

rm -rf dist
mkdir -p dist/src

mv .release/action.yml .
mv .release/action-types.yml .
mv .release/dist/src/ ./dist/
mv .release/*.json .
mv .release/node_modules .

git add -f action.yml action-types.yml ./dist/src/*.js package.json package-lock.json node_modules

rm -rf .release

set +x

echo "Done. Please check 'git diff --cached' to verify changes. If ok, add version tag and push it to remote"
