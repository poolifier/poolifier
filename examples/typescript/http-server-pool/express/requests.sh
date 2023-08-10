#!/usr/bin/env bash

set -e

for ((request=1;request<=60;request++))
do
  time curl -i -H "Content-Type: application/json" -X POST -d '{"key1":"value1", "key2":"value2"}' http://localhost:8080/api/echo
done
