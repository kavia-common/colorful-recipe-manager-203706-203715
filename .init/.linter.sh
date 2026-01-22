#!/bin/bash
cd /home/kavia/workspace/code-generation/colorful-recipe-manager-203706-203715/recipe_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

