export function computeMrzCheckDigit(value: string): number {
  let code = 0;
  const factors = [7, 3, 1];
  for (let i = 0; i < value.length; i += 1) {
    let charCode = value.charCodeAt(i);
    if (charCode === 60) charCode = 0;
    else if (charCode >= 65) charCode -= 55;
    else if (charCode >= 48) charCode -= 48;
    code += charCode * factors[i % 3];
  }
  return code % 10;
}

export function matchesCheckDigit(value: string, check: string): boolean {
  if (!/^\d$/.test(check)) return false;
  return computeMrzCheckDigit(value) === Number(check);
}
