#!/usr/bin/env node
require('./tenant-isolation-runner').run('ai').then(() => console.log('phase0 AI isolation VERIFIED')).catch(error => { console.error(String(error?.message || error)); process.exit(1); });
