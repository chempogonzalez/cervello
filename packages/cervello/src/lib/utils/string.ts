
export function capitalize (str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function isCamelCase (str: string): boolean {
  const regex = /^[a-z]+([A-Z][a-z]*)*$/

  return regex.test(str)
}
