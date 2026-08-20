/**
 * get the base name of a path
 * @param {string} path
 * @returns {string}
 * @example
 * basename('/path/to/file.txt') // 'file.txt'
 */
export function basename(path) {
  return path.split("/").pop();
}
