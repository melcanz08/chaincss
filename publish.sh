#!/bin/bash
npm version patch
git push --tags
git checkout main
git merge master
git push origin main
git checkout master