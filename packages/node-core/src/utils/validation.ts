export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
  
  static isValidJson(str: string): boolean {
    try {
      JSON.parse(str)
      return true
    } catch {
      return false
    }
  }
}