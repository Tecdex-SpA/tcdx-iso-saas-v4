#!/usr/bin/env node
require('./tenant-isolation-runner').run('file').then(() => console.log('phase0 file isolation VERIFIED')).catch(error => { console.error(String(error?.message || error)); process.exit(1); });
