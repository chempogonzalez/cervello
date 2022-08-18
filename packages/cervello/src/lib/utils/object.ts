export function deepClone <T> (obj: any): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  let newObj = {} as any
  if (Array.isArray(obj)) {
    newObj = obj.map(item => deepClone(item))
  } else {
    Object.keys(obj).forEach((key) => {
      // eslint-disable-next-line no-return-assign
      return newObj[key] = deepClone(obj[key])
    })
  }
  return newObj as T
}
