"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Users, Clock, Image as ImageIcon } from "lucide-react";

// Mock data to demonstrate the UI until API hooks are fully wired to /api/analytics/event
const MOCK_DATA = {
  totalSessions: 142,
  completedSessions: 128,
  completionRate: 90.1,
  averageComposeMs: 1240,
  filterPopularity: [
    { name: "Normal", value: 65 },
    { name: "B&W Glam", value: 42 },
    { name: "Vintage", value: 21 },
  ]
};

export default function AnalyticsDashboardPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Event Analytics</h1>
        <p className="text-slate-500 mt-2">Real-time performance metrics for your photobooth events.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Sessions</p>
            <p className="text-2xl font-bold">{MOCK_DATA.totalSessions}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Completion Rate</p>
            <p className="text-2xl font-bold">{MOCK_DATA.completionRate}%</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Avg. Processing Time</p>
            <p className="text-2xl font-bold">{(MOCK_DATA.averageComposeMs / 1000).toFixed(2)}s</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
            <ImageIcon size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Completed Photos</p>
            <p className="text-2xl font-bold">{MOCK_DATA.completedSessions}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Filter Popularity Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Filter Popularity</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_DATA.filterPopularity} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9', opacity: 0.1 }}
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} 
                />
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sticker Popularity (Placeholder for future) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-slate-500">
          <Activity size={48} className="mb-4 opacity-50" />
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Sticker Popularity</h2>
          <p className="text-sm mt-2">More data needed to generate this chart.</p>
        </div>
      </div>
    </div>
  );
}
