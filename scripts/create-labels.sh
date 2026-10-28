#!/usr/bin/env bash
# Creates the project labels. Needs the GitHub CLI (https://cli.github.com) and `gh auth login`.
# Run from inside the cloned repository: bash scripts/create-labels.sh
set -e
mk() { gh label create "$1" --color "$2" --description "$3" --force; }
mk client   1d76db "React web client (C1)"
mk server   0e8a16 "Express application (C2 to C7, C10)"
mk database fbca04 "PostgreSQL and file storage (C8, C9)"
mk docs     c5def5 "Documentation"
mk ci       ededed "Continuous integration"
mk must     b60205 "MoSCoW: Must have"
mk should   d93f0b "MoSCoW: Should have"
mk could    fef2c0 "MoSCoW: Could have"
mk wont     cccccc "MoSCoW: Won't have this time"
echo "Labels created."
