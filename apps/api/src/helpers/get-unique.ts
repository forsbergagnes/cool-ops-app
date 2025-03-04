export const getUnique = (array: Array<string | undefined>) => {
  return array.filter((v, i, a) => a.indexOf(v) === i)
}
