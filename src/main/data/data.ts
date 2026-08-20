const data: Record<string, any> = {};

// Getter
export function getData(key: string) {
  return data[key];
}

// Setter
export function setData(key: string, value: any) {
  data[key] = value;
}
