const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener mínimo 8 caracteres e incluir mayúsculas, minúsculas, números y símbolos.';

function validatePasswordStrength(password) {
  const value = String(password || '');
  const failures = [];

  if (value.length < 8) failures.push('min_length');
  if (!/[A-Z]/.test(value)) failures.push('uppercase');
  if (!/[a-z]/.test(value)) failures.push('lowercase');
  if (!/[0-9]/.test(value)) failures.push('number');
  if (!/[^A-Za-z0-9]/.test(value)) failures.push('symbol');

  return {
    valid: failures.length === 0,
    failures,
  };
}

function getPasswordPolicyMessage() {
  return PASSWORD_POLICY_MESSAGE;
}

module.exports = {
  validatePasswordStrength,
  getPasswordPolicyMessage,
};
