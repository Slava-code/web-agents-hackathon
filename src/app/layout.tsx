import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Medical Vendor Dashboards',
  description: 'OR Turnover Vendor Dashboard Simulation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
