#!/usr/bin/env bash

set -e

examples=$(find . -maxdepth 3 -name "package.json" -exec dirname {} \;)

for example in $examples
do
  echo -e "Building $example"
  cd $example
  pnpm install --ignore-scripts --frozen-lockfile
  pnpm build
  cd -
done

