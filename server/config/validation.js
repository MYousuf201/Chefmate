export function validateId(value, name = 'ID') {
  if (value == null) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    err.errorMessage = `Invalid ${name}`;
    throw err;
  }
  const str = String(value);
  if (!/^\d+$/.test(str)) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    err.errorMessage = `Invalid ${name}`;
    throw err;
  }
  return parseInt(str, 10);
}
