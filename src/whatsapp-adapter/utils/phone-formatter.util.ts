export function formatPhoneToJid(phoneNumber: string): string {
  const cleanNumber = phoneNumber.replace(/\D/g, "")

  if (!cleanNumber) {
    throw new Error("Número de telefone inválido")
  }

  if (phoneNumber.includes("@g.us")) {
    return phoneNumber
  }

  if (phoneNumber.includes("@s.whatsapp.net")) {
    return phoneNumber
  }

  return `${cleanNumber}@s.whatsapp.net`
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleanNumber = phoneNumber.replace(/\D/g, "")

  return cleanNumber.length >= 10 && cleanNumber.length <= 15
}

export function extractPhoneNumbers(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "")
}
