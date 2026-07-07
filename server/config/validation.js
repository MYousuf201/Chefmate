export function validateId(value, name = 'ID') {
  const num = parseInt(value);
  if (isNaN(num) || num < 1) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    err.errorMessage = `Invalid ${name}`;
    throw err;
  }
  return num;
}
