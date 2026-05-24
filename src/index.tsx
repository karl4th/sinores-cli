#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

const resume = process.argv.includes('--resume');

render(<App resume={resume} />, { exitOnCtrlC: false });
