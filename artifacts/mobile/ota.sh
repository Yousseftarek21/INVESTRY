#!/bin/sh
cd "$(dirname "$0")"
eas update --channel production --message "Portfolio: hide holding subtitles in overview"
