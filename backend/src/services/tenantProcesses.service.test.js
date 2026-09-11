'use strict';

const assert = require('assert');
const tenantProcesses = require('./tenantProcesses.service');

const { isMissingProcessContract } = tenantProcesses._private;

assert.equal(
  isMissingProcessContract({
    code: '42P01',
    message: 'relation "tenant_processes" does not exist',
  }),
  true,
  'missing optional tenant_processes relation should degrade'
);

assert.equal(
  isMissingProcessContract({
    code: '42P01',
    message: 'relation "users" does not exist',
  }),
  false,
  'missing mandatory users relation must not degrade'
);

assert.equal(
  isMissingProcessContract({
    code: '42703',
    message: 'column p.area does not exist',
  }),
  true,
  'known optional process column should degrade'
);

assert.equal(
  isMissingProcessContract({
    code: '42703',
    message: 'column p.typo_area does not exist',
  }),
  false,
  'arbitrary process SQL typo must not degrade'
);

assert.equal(
  isMissingProcessContract({
    code: '42703',
    message: 'column u.email does not exist',
  }),
  false,
  'mandatory joined user column drift must not degrade'
);

console.log('tenantProcesses.service tests OK');
