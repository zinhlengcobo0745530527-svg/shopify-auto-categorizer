#!/data/data/com.termux/files/usr/bin/bash

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Start server with nodemon
npx nodemon --config nodemon.json
