const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, '../activities/pingpong.html'), 'utf-8');
const match = htmlContent.match(/function clamp\([^)]*\)\s*{[^}]*}/);

if (!match) {
  throw new Error("Could not find clamp function in pingpong.html");
}

// Evaluate the function in the current scope
eval(match[0]);

describe('clamp', () => {
  it('should return the value if within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should return the lower bound if value is below lower bound', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('should return the upper bound if value is above upper bound', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('should handle negative bounds', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it('should handle decimal values', () => {
    expect(clamp(5.5, 0, 10)).toBe(5.5);
    expect(clamp(-0.5, 0, 10)).toBe(0);
    expect(clamp(10.5, 0, 10)).toBe(10);
  });
});
