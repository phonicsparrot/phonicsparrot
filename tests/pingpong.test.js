const { hexToRgb } = require('../src/assets/js/utils.js');

describe('hexToRgb', () => {
  it('should correctly convert hex color #000000 to rgb 0,0,0', () => {
    expect(hexToRgb('#000000')).toBe('0,0,0');
  });

  it('should correctly convert hex color #FFFFFF to rgb 255,255,255', () => {
    expect(hexToRgb('#FFFFFF')).toBe('255,255,255');
  });

  it('should correctly convert hex color #FF0000 to rgb 255,0,0', () => {
    expect(hexToRgb('#FF0000')).toBe('255,0,0');
  });

  it('should correctly convert hex color #00FF00 to rgb 0,255,0', () => {
    expect(hexToRgb('#00FF00')).toBe('0,255,0');
  });

  it('should correctly convert hex color #0000FF to rgb 0,0,255', () => {
    expect(hexToRgb('#0000FF')).toBe('0,0,255');
  });

  it('should correctly convert lowercase hex color #ffffff to rgb 255,255,255', () => {
    expect(hexToRgb('#ffffff')).toBe('255,255,255');
  });

  it('should correctly convert a random hex color #2ec4b6 to rgb', () => {
    // 2e -> 46, c4 -> 196, b6 -> 182
    expect(hexToRgb('#2ec4b6')).toBe('46,196,182');
  });

  it('should correctly convert a random hex color #e94560 to rgb', () => {
    // e9 -> 233, 45 -> 69, 60 -> 96
    expect(hexToRgb('#e94560')).toBe('233,69,96');
  });
});
