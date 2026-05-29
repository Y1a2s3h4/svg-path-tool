let counter = 0;

export function nextId(prefix = 'path'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

const PALETTE = [
  '#5e'.concat('ead4'), // teal
  '#fbbf24', // amber
  '#f472b6', // pink
  '#60a5fa', // blue
  '#a3e635', // lime
  '#c084fc', // purple
  '#fb7185', // rose
  '#34d399', // emerald
];

export function colorForIndex(index: number): string {
  return PALETTE[index % PALETTE.length];
}
