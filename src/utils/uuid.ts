export function generateUuidV4(): string {
  let seed = Date.now() + Math.random() * 1000;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = (seed + Math.random() * 16) % 16 | 0;
    seed = Math.floor(seed / 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
