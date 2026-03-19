"use client";

import { useState, useEffect } from "react";
import { Bell, Send, Users, AlertTriangle, Sparkles, Shield, RefreshCw } from "lucide-react";
import { 
  getNotificationStats, 
  sendSystemNotification,
  type NotificationStats,
  type SystemNotificationRequest 
} from "@/lib/admin-api";

const NOTIFICATION_TYPES = {
  system_maintenance: { label: "System Maintenance", icon: AlertTriangle, color: "var(--amber)" },
  feature_announcement: { label: "Feature Announcement", icon: Sparkles, color: "var(--acid)" },
  security_alert: { label: "Security Alert", icon: Shield, color: "var(--danger)" },
};

export default function AdminNotificationsPage() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "system_maintenance",
    target_tiers: ["free", "pro", "team"],
    expires_hours: 24,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getNotificationStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load notification stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    try {
      const result = await sendSystemNotification(formData);
      alert(`✅ ${result.message}`);
      setFormData({
        title: "",
        message: "",
        type: "system_maintenance",
        target_tiers: ["free", "pro", "team"],
        expires_hours: 24,
      });
      loadStats(); // Refresh stats
    } catch (error: any) {
      alert(`❌ Failed to send notification: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleTierToggle = (tier: string) => {
    setFormData(prev => ({
      ...prev,
      target_tiers: prev.target_tiers.includes(tier)
        ? prev.target_tiers.filter(t => t !== tier)
        : [...prev.target_tiers, tier]
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">System Notifications</h1>
        <p className="text-[rgba(255,255,255,0.5)]">
          Send notifications to users about maintenance, features, and security updates.
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-[var(--cyan)]" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_notifications}</p>
                <p className="text-xs text-[rgba(255,255,255,0.4)]">Total Sent</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-[var(--amber)]" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_unread}</p>
                <p className="text-xs text-[rgba(255,255,255,0.4)]">Unread</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-[var(--acid)]" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.by_type.reduce((sum, type) => sum + type.count, 0)}
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.4)]">This Month</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <RefreshCw size={20} className="text-[var(--purple)]" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {((stats.total_notifications - stats.total_unread) / Math.max(stats.total_notifications, 1) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-[rgba(255,255,255,0.4)]">Read Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Send Notification Form */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Send size={18} />
            Send System Notification
          </h2>

          <form onSubmit={handleSendNotification} className="space-y-4">
            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="input w-full"
                placeholder="e.g., Scheduled Maintenance Tonight"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="input w-full h-24 resize-none"
                placeholder="Detailed message about the notification..."
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="input w-full"
              >
                {Object.entries(NOTIFICATION_TYPES).map(([key, type]) => (
                  <option key={key} value={key}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">Target Tiers</label>
              <div className="flex gap-2">
                {["free", "pro", "team"].map(tier => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => handleTierToggle(tier)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      formData.target_tiers.includes(tier)
                        ? "bg-[var(--cyan)]/20 text-[var(--cyan)] border border-[var(--cyan)]/30"
                        : "bg-white/5 text-[rgba(255,255,255,0.5)] hover:bg-white/10"
                    }`}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">Expires After (hours)</label>
              <input
                type="number"
                value={formData.expires_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, expires_hours: parseInt(e.target.value) }))}
                className="input w-full"
                min="1"
                max="168"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Sending..." : "Send Notification"}
            </button>
          </form>
        </div>

        {/* Recent Notifications */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Notifications</h2>
          
          {stats?.recent_notifications.length === 0 ? (
            <div className="text-center py-8 text-[rgba(255,255,255,0.4)]">
              <Bell size={24} className="mx-auto mb-2 opacity-50" />
              <p>No notifications sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats?.recent_notifications.map((notification, index) => {
                const typeInfo = NOTIFICATION_TYPES[notification.type as keyof typeof NOTIFICATION_TYPES];
                const Icon = typeInfo?.icon || Bell;
                
                return (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ 
                        backgroundColor: `${typeInfo?.color || 'var(--cyan)'}15`,
                        color: typeInfo?.color || 'var(--cyan)'
                      }}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-[rgba(255,255,255,0.4)]">
                        {new Date(notification.created_at).toLocaleDateString()} • 
                        {notification.read ? " Read" : " Unread"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}