#!/usr/bin/env node
import React, { useState } from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { SetupScreen } from './components/SetupScreen.js';
import { getMoonshotApiKey, initConfig } from './services/config.js';

const resume = process.argv.includes('--resume');
const initConfigFlag = process.argv.includes('--init-config');

if (initConfigFlag) {
  initConfig();
  console.log('Created ~/.sinores/config.json');
  console.log('Edit it and add your moonshotApiKey.');
  process.exit(0);
}

function Root() {
  const [ready, setReady] = useState(() => !!getMoonshotApiKey());

  if (!ready) {
    return (
      <SetupScreen
        onComplete={() => setReady(true)}
      />
    );
  }

  return <App resume={resume} />;
}

render(<Root />, { exitOnCtrlC: false });
