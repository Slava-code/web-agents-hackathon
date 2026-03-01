'use client'

import Link from 'next/link'

export default function Home() {
  const dashboards = [
    {
      name: 'UV Disinfection Robot Portal',
      path: '/uv-robot',
      description: 'Xenex/Tru-D style - Dark theme, modern SaaS',
      color: 'from-purple-600 to-blue-600',
    },
    {
      name: 'Environmental Monitoring System',
      path: '/environmental',
      description: 'Medical IoT - Live charts, sensor data, alerts',
      color: 'from-green-600 to-teal-600',
    },
    {
      name: 'Aethon TUG Robot',
      path: '/tug-robot',
      description: 'Autonomous mobile robot - Delivery tracking, fleet management',
      color: 'from-blue-500 to-slate-700',
    },
    {
      name: 'Room Scheduling / EHR System',
      path: '/ehr',
      description: 'Epic/Cerner style - Dense, tab-heavy interface',
      color: 'from-orange-500 to-red-600',
    },
    {
      name: 'Variable Tracker',
      path: '/camera',
      description: 'Epic-style 2010s UI - UV & TUG metrics monitoring',
      color: 'from-blue-600 to-blue-800',
    },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">
          OR Turnover Vendor Dashboards
        </h1>
        <p className="text-slate-400 mb-8">
          5 different medical device vendor interfaces for browser agent testing
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboards.map((dashboard) => (
            <Link
              key={dashboard.path}
              href={dashboard.path}
              className="group block"
            >
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-500 transition-all hover:transform hover:scale-105">
                <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${dashboard.color} mb-4`} />
                <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                  {dashboard.name}
                </h2>
                <p className="text-slate-400 text-sm">
                  {dashboard.description}
                </p>
                <div className="mt-4 text-blue-400 text-sm font-medium">
                  Open Dashboard →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/command-center" className="group block">
            <div className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 rounded-xl p-6 border border-emerald-500/30 hover:border-emerald-400/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-2 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Mission Control</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                Command Center
              </h3>
              <p className="text-slate-400 text-sm">
                Issue commands, watch AI agents navigate dashboards live, and monitor room status in real-time.
              </p>
            </div>
          </Link>

          <Link href="/agent" className="group block">
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30 hover:border-blue-400/50 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-2 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Browser Agent</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                Run Browser Agent
              </h3>
              <p className="text-slate-400 text-sm">
                Developer tools: teach the agent about dashboard pages, configure monitoring.
              </p>
            </div>
          </Link>
        </div>

        <div className="mt-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-2">For Browser Agents</h3>
          <p className="text-slate-400 text-sm">
            Each dashboard has real interactive HTML elements (buttons, inputs, sliders, dropdowns).
            State changes are visible when elements are clicked. The agent must parse the DOM to
            identify which elements to interact with.
          </p>
        </div>
      </div>
    </main>
  )
}
