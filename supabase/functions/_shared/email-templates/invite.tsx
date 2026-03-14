/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

const logoUrl = 'https://erhmkxbcubdopxbryetm.supabase.co/storage/v1/object/public/email-assets/logo.jpeg'

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join Tutwine 💕</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={logoUrl} width="48" height="48" alt="Tutwine" style={logo} />
        <Heading style={h1}>You've been invited!</Heading>
        <Text style={text}>
          Someone invited you to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>Tutwine</strong>
          </Link>
          . Let's Mingle — click below to accept and create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: 'hsl(350, 75%, 58%)', textDecoration: 'underline' }
const button = {
  background: 'linear-gradient(135deg, hsl(350, 75%, 58%), hsl(20, 90%, 62%))',
  backgroundColor: 'hsl(350, 75%, 58%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '16px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '12px', color: 'hsl(350, 10%, 60%)', margin: '32px 0 0' }
