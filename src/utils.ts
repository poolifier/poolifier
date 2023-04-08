/**
 * An intentional empty function.
 */
export const EMPTY_FUNCTION: () => void = Object.freeze(() => {
  /* Intentionally empty */
})

/**
 * Returns the median of the given data set.
 *
 * @param dataSet - Data set.
 * @returns The median of the given data set.
 */
export const median = (dataSet: number[]): number => {
  if (Array.isArray(dataSet) && dataSet.length === 1) {
    return dataSet[0]
  }
  const sortedDataSet = dataSet.slice().sort((a, b) => a - b)
  const middleIndex = Math.floor(sortedDataSet.length / 2)
  if (sortedDataSet.length % 2 === 0) {
    return sortedDataSet[middleIndex / 2]
  }
  return (sortedDataSet[middleIndex - 1] + sortedDataSet[middleIndex]) / 2
}
