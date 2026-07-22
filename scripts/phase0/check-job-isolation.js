#!/usr/bin/env node
require('./tenant-isolation-runner').run('job').then(() => console.log('phase0 job isolation VERIFIED')).catch(error => { console.error(String(error?.message || error)); process.exit(1); });
