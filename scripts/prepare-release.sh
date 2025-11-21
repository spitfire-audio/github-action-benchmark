#!/bin/bash

set -e

version="$1"

if [[ "$version" == "" ]]; then
    echo 'Release branch name must be given as first argument' >&2
    exit 1
fi

if [ ! -d .git ]; then
    echo 'This script must be run at root directory of this repository' >&2
    exit 1
fi

if ! git diff --quiet; then
    echo 'Working tree is dirty! Please ensure all changes are committed and working tree is clean' >&2
    exit 1
fi

if ! git diff --cached --quiet; then
    echo 'Git index is dirty! Please ensure all changes are committed and Git index is clean' >&2
    exit 1
fi

branch="$(git symbolic-ref --short HEAD)"
if [[ "$branch" == "$version" ]]; then
    echo "Current branch $branch cannot be not targeted. Please change target $version or select a different branch" >&2
    exit 1
fi

echo "Releasing to $version branch..."

# Clean up anything that may be left over from previous builds or releases
rm -rf dist
rm -rf .release

set -x

# Build/Lint/Test/prune
npm install
npm run build
npm run lint
npm test
npm prune --production

# Make the release ark to restore after washing the repo of non-release
mkdir -p .release
cp action.yml action-types.yml package.json package-lock.json .release/
rsync -R -v dist/src/*.js .release/
rsync -R -v dist/src/**/*.js .release/
cp -R node_modules .release/node_modules


# Builds can cause conflicts, so remove any tracked changes
git restore .

# Check out the release branch
git checkout "$version"
git pull

# Add some last-minute stragglers to the ark
cp -R .git .release/.git
cp .gitignore .release/

# Here comes the flood: clean the repo of all files
set -e
git rm -r --cached .  # stop tracking everything
git add .release  # temporarily track release
git clean -fd  # clear all non-tracked files
rm -rf node_modules  # clear last build dependency installation
rm -rf dist  # clear last distribution

## Flood is over, all release files can leave the ark
mkdir -p dist/src
mv .release/action.yml .
mv .release/action-types.yml .
mv .release/dist/src/ ./dist/
mv .release/*.json .
mv .release/node_modules .

# Force-add things here
git add -f action.yml action-types.yml ./dist/src/*.js package.json package-lock.json node_modules
#rm -rf .release
set +x

echo "Done. Please check 'git diff --cached' to verify changes. If ok, add version tag and push it to remote"

