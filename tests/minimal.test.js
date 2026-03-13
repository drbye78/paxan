// Minimal test to check if jest is working
describe('Minimal Test', () => {
  test('should pass simple assertion', () => {
    console.log('TEST STARTED');
    expect(1 + 1).toBe(2);
    console.log('TEST PASSED');
  });
});
