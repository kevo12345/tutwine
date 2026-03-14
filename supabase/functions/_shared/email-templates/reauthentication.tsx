/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

const logoUrl = 'https://erhmkxbcubdopxbryetm.supabase.co/storage/v1/object/public/email-assets/logo.jpeg'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Tutwine verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={logoUrl} width="48" height="48" alt="Tutwine" style={logo} />
        <Heading style={h1}>Verification code</Heading>
        <Text style={text}>Use this code to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: 'hsl(30, 25%, 98%)', fontFamily: "'DM Sans', 'Outfit', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logo = { borderRadius: '12px', marginBottom: '24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(350, 20%, 12%)',
  margin: '0 0 20px',
  fontFamily: "'Outfit', Arial, sans-serif",
}
const text = {
  fontSize: '15px',
  color: 'hsl(350, 10%, 45%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const codeStyle = {
  fontFamily: "'Outfit', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(350, 75%, 58%)',
  margin: '0 0 30px',
  letterSpacing: '4px',
}
const footer = { fontSize: '12px', color: 'hsl(350, 10%, 60%)', margin: '32px 0 0' }
