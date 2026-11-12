import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EquiCity — Displacement Early Warning System',
  description: 'Eco-Gentrification & Urban Displacement Early Warning System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-xl">🌿 EquiCity</span>
            <span className="text-gray-500 text-sm">Displacement Early Warning</span>
          </div>
          <div className="flex gap-4 ml-4">
            <a href="/" className="text-gray-300 hover:text-white text-sm font-medium transition-colors">Dashboard</a>
            <a href="/simulate" className="text-gray-300 hover:text-white text-sm font-medium transition-colors">Simulator</a>
            <a href="/alerts" className="text-gray-300 hover:text-white text-sm font-medium transition-colors">Alerts</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
