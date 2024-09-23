#!/usr/bin/env bash

set -e

examples=$(find . -maxdepth 3 -name "package.json" -exec dirname {} \;)

for example in $examples
do
  cd $example
  # echo -e "Installing dependencies in $example"
  # pnpm install --ignore-scripts --frozen-lockfile
  # echo -e "Building $(basename $example)"
  # pnpm build
  pnpm update
  pnpm dedupe
  pnpm outdated
  cd -
done
