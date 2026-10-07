#!/bin/sh
if command -v gradle >/dev/null 2>&1; then
    exec gradle "$@"
else
    echo "Gradle not found" >&2
    exit 1
fi
