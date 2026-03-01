import type { Metadata } from 'next'
import './globals.css'
import ConvexClientProvider from '@/components/ConvexClientProvider'

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
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
