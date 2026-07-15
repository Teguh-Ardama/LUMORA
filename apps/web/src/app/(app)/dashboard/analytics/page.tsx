"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Activity, Users, Clock, Image as ImageIcon, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { AnalyticsSummary } from "@lumora/contracts";

const COLORS = ["#ec4899", "#8b5cf6", "#f59e0b", "#06b6d4", "#22c55e"];

export default function AnalyticsDashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: () => apiClient.get<{ summary: AnalyticsSummary }>("/api/analytics/summary"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = summary?.summary;
  if (!s) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-center text-muted-foreground">
        <p>No analytics data available yet.</p>
      </div>
    );
  }

  const completionRate = s.totalSessions > 0
    ? Math.round((s.readySessions / s.totalSessions) * 100)
    : 0;

  const deliveryData = Object.entries(s.deliveriesByChannel ?? {}).map(([k, v]) => ({
    name: k,
    value: v,
  }));

  const captureData = Object.entries(s.captureSourceSplit ?? {}).map(([k, v]) => ({
    name: k,
    value: v,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Event Analytics</h1>
        <p className="text-muted-foreground mt-2">Real-time performance metrics for your photobooth events.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
            <p className="text-2xl font-bold">{s.totalSessions}</p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
            <p className="text-2xl font-bold">{completionRate}%</p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Avg. Processing</p>
            <p className="text-2xl font-bold">{s.avgComposeMs ? `${(s.avgComposeMs / 1000).toFixed(1)}s` : "—"}</p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
            <ImageIcon size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Photos Captured</p>
            <p className="text-2xl font-bold">{s.totalPhotos}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions per Day */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Sessions per Day (30 days)</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.sessionsPerDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filter Usage */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Filter Popularity</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.filterUsage} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="filterName" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delivery Success */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Deliveries</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deliveryData.length > 0 ? deliveryData : [{ name: "No data", value: 1 }]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {deliveryData.length > 0
                    ? deliveryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)
                    : <Cell fill="#334155" opacity={0.3} />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Capture Source Split */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Capture Source</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={captureData.length > 0 ? captureData : [{ name: "No data", value: 1 }]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {captureData.length > 0
                    ? captureData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)
                    : <Cell fill="#334155" opacity={0.3} />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
