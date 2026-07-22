#!/usr/bin/env node
require('./tenant-isolation-runner').run('search').then(() => console.log('phase0 search isolation VERIFIED')).catch(error => { console.error(String(error?.message || error)); process.exit(1); });
