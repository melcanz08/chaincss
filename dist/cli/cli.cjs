#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");
const cliPath = path.join(__dirname, "index.js");
const args = process.argv.slice(2);
const child = spawn("node", [cliPath, ...args], { stdio: "inherit", shell: false });
child.on("close", (code) => process.exit(code));
