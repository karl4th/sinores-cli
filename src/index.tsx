#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { getMoonshotApiKey, initConfig, configExists } from './services/config.js';

const resume = process.argv.includes('--resume');
const initConfigFlag = process.argv.includes('--init-config');

if (initConfigFlag) {
  initConfig();
  console.log('Created ~/.sinores/config.json');
  console.log('Edit it and add your moonshotApiKey.');
  process.exit(0);
}

if (!getMoonshotApiKey()) {
  console.error('MOONSHOT_API_KEY not found.');
  if (!configExists()) {
    console.error('Run: sinores --init-config');
  } else {
    console.error('Add your API key to ~/.sinores/config.json or set MOONSHOT_API_KEY env var.');
  }
  process.exit(1);
}

render(<App resume={resume} />, { exitOnCtrlC: false });
