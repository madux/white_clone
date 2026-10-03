type ModalLayer = {
  id: number;
  onEscape: () => void;
};

let nextId = 0;
const layers: ModalLayer[] = [];

export function registerModalLayer(onEscape: () => void): number {
  const id = ++nextId;
  layers.push({ id, onEscape });
  return id;
}

export function unregisterModalLayer(id: number) {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index >= 0) layers.splice(index, 1);
}

export function isTopModalLayer(id: number): boolean {
  const top = layers[layers.length - 1];
  return top?.id === id;
}
