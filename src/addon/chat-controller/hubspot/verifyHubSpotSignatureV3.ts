import { Signature } from '@hubspot/api-client'

export interface IVerifyHubSpotSignatureV3Options {
  secret: string
  method: string
  url: string
  rawBody: string
  timestampHeader: string
  signatureHeader: string
}

export function verifyHubSpotSignatureV3(opts: IVerifyHubSpotSignatureV3Options): boolean {
  const { secret, method, url, rawBody, timestampHeader, signatureHeader } = opts

  if (!secret || !signatureHeader || !timestampHeader) {
    return false
  }

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) {
    return false
  }

  try {
    return Signature.isValid({
      method,
      signatureVersion: 'v3',
      url,
      requestBody: rawBody,
      clientSecret: secret,
      signature: signatureHeader,
      timestamp,
    })
  } catch {
    return false
  }
}
