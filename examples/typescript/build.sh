#!/usr/bin/env bash

set -e

examples=$(find . -name "package.json" -maxdepth 3 -exec dirname {} \;)

for example in $examples
do
  echo -e "Building $example"
  cd $example
  pnpm install --ignore-scripts --frozen-lockfile
  pnpm build
  cd -
done

