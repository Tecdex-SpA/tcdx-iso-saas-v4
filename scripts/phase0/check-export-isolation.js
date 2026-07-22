#!/usr/bin/env node
require('./tenant-isolation-runner').run('export').then(() => console.log('phase0 export isolation VERIFIED')).catch(error => { console.error(String(error?.message || error)); process.exit(1); });
