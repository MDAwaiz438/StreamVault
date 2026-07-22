#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing Node.js dependencies..."
npm install

echo "Installing Python and pip dependencies..."
# Render typically pre-installs Python. We just need to install our pip packages globally or in a user directory.
pip install -r requirements.txt || pip3 install -r requirements.txt
