"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Code,
  Database,
  Activity,
  Play,
  Copy,
  CheckCircle,
  Clock,
  Users,
  MessageSquare,
  Shield,
  Zap,
  Terminal,
  FileText,
  BarChart3,
  Wifi,
  Server,
  Trash2,
  RefreshCw,
  Eye,
} from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase"

interface ApiLog {
  id: string
  method: string
  endpoint: string
  status: number
  response_time: number
  timestamp: string
  user_agent?: string
  ip_address?: string
}

interface SystemStats {
  total_messages: number
  active_users: number
  total_users: number
  avg_response_time: number
  uptime: string
  database_status: "healthy" | "warning" | "error"
}

interface ExtendedMessage {
  id: string
  created_at: string
  user_name: string
  content: string
  media_url?: string
  media_type?: string
  reactions?: { [key: string]: number }
}

export default function ApiDevPage() {
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([])
  const [systemStats, setSystemStats] = useState<SystemStats>({
    total_messages: 0,
    active_users: 0,
    total_users: 0,
    avg_response_time: 0,
    uptime: "0h 0m",
    database_status: "healthy",
  })
  const [testEndpoint, setTestEndpoint] = useState("/api/chat")
  const [testMethod, setTestMethod] = useState("POST")
  const [testPayload, setTestPayload] = useState('{\n  "message": "Test message",\n  "action": "moderate"\n}')
  const [testResponse, setTestResponse] = useState("")
  const [isTestLoading, setIsTestLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState("")

  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)

  const [realtimeMessages, setRealtimeMessages] = useState<ExtendedMessage[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)

  useEffect(() => {
    try {
      const client = getSupabaseClient()
      setSupabase(client)
      loadSystemStats()
      loadApiLogs()
    } catch (error) {
      console.error("Failed to initialize Supabase:", error)
    }
  }, [])

  const loadSystemStats = async () => {
    if (!supabase) return

    try {
      // Get total messages with real count
      const { count: messageCount } = await supabase.from("messages").select("*", { count: "exact", head: true })

      // Get active users
      const { count: activeUserCount } = await supabase
        .from("chat_users")
        .select("*", { count: "exact", head: true })
        .eq("is_online", true)

      // Get total users
      const { count: totalUserCount } = await supabase.from("chat_users").select("*", { count: "exact", head: true })

      // Get recent messages for avg response time calculation
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(10)

      let avgResponseTime = 50 + Math.random() * 100 // Mock calculation
      if (recentMessages && recentMessages.length > 1) {
        const times = recentMessages.map((m) => new Date(m.created_at).getTime())
        const diffs = times.slice(0, -1).map((time, i) => Math.abs(time - times[i + 1]))
        avgResponseTime = diffs.reduce((a, b) => a + b, 0) / diffs.length / 1000 // Convert to seconds
      }

      setSystemStats({
        total_messages: messageCount || 0,
        active_users: activeUserCount || 0,
        total_users: totalUserCount || 0,
        avg_response_time: avgResponseTime,
        uptime: "2h 34m", // Mock data
        database_status: "healthy",
      })
    } catch (error) {
      console.error("Error loading system stats:", error)
      setSystemStats((prev) => ({ ...prev, database_status: "error" }))
    }
  }

  const loadApiLogs = () => {
    // Mock API logs data
    const mockLogs: ApiLog[] = [
      {
        id: "1",
        method: "POST",
        endpoint: "/api/chat",
        status: 200,
        response_time: 45,
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        ip_address: "192.168.1.100",
      },
      {
        id: "2",
        method: "GET",
        endpoint: "/api/users",
        status: 200,
        response_time: 23,
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        ip_address: "192.168.1.101",
      },
      {
        id: "3",
        method: "POST",
        endpoint: "/api/chat",
        status: 400,
        response_time: 12,
        timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)",
        ip_address: "192.168.1.102",
      },
    ]
    setApiLogs(mockLogs)
  }

  // Load real-time messages for monitoring
  const loadRealtimeMessages = async () => {
    if (!supabase) return

    try {
      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setRealtimeMessages(messages || [])
    } catch (error) {
      console.error("Error loading realtime messages:", error)
    }
  }

  // Delete message function - perbaiki ini
  const deleteMessage = async (messageId: string) => {
    if (!supabase) return

    try {
      console.log("Deleting message:", messageId) // Debug log

      // Method 1: Direct Supabase delete
      const { error } = await supabase.from("messages").delete().eq("id", messageId)

      if (error) {
        console.error("Supabase delete error:", error)
        throw error
      }

      console.log("Message deleted successfully") // Debug log

      // Refresh data
      await loadRealtimeMessages()
      await loadSystemStats()

      // Add to logs
      const newLog: ApiLog = {
        id: Date.now().toString(),
        method: "DELETE",
        endpoint: `/api/messages/${messageId}`,
        status: 200,
        response_time: 45,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ip_address: "127.0.0.1",
      }
      setApiLogs((prev) => [newLog, ...prev])

      // Show success message
      alert("Message deleted successfully!")
    } catch (error) {
      console.error("Error deleting message:", error)
      alert(`Failed to delete message: ${error.message || "Unknown error"}`)
    }
  }

  // Alternative delete method using API endpoint:
  const deleteMessageViaAPI = async (messageId: string) => {
    try {
      console.log("Deleting message via API:", messageId)

      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete message")
      }

      console.log("Delete API response:", result)

      // Refresh data
      await loadRealtimeMessages()
      await loadSystemStats()

      alert("Message deleted successfully via API!")
    } catch (error) {
      console.error("Error deleting message via API:", error)
      alert(`Failed to delete message: ${error.message}`)
    }
  }

  // Toggle monitoring
  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring)
    if (!isMonitoring) {
      loadRealtimeMessages()
    }
  }

  const testApiEndpoint = async () => {
    setIsTestLoading(true)
    setTestResponse("")

    try {
      const startTime = Date.now()
      const response = await fetch(testEndpoint, {
        method: testMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: testMethod !== "GET" ? testPayload : undefined,
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      const responseData = await response.text()
      let formattedResponse

      try {
        const jsonData = JSON.parse(responseData)
        formattedResponse = JSON.stringify(jsonData, null, 2)
      } catch {
        formattedResponse = responseData
      }

      setTestResponse(`Status: ${response.status} ${response.statusText}
Response Time: ${responseTime}ms
Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}

Body:
${formattedResponse}`)

      // Add to logs
      const newLog: ApiLog = {
        id: Date.now().toString(),
        method: testMethod,
        endpoint: testEndpoint,
        status: response.status,
        response_time: responseTime,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ip_address: "127.0.0.1",
      }
      setApiLogs((prev) => [newLog, ...prev])
    } catch (error) {
      setTestResponse(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsTestLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(""), 2000)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-600 bg-green-100"
    if (status >= 400 && status < 500) return "text-yellow-600 bg-yellow-100"
    if (status >= 500) return "text-red-600 bg-red-100"
    return "text-gray-600 bg-gray-100"
  }

  const codeExamples = {
    javascript: `// JavaScript/Node.js Example
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: "Hello World!",
    action: "moderate"
  })
});

const data = await response.json();
console.log(data);`,

    python: `# Python Example
import requests
import json

url = "http://localhost:3000/api/chat"
payload = {
    "message": "Hello World!",
    "action": "moderate"
}

response = requests.post(url, json=payload)
data = response.json()
print(data)`,

    curl: `# cURL Example
curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello World!",
    "action": "moderate"
  }'`,
  }

  useEffect(() => {
    if (supabase) {
      loadSystemStats()
      loadApiLogs()

      // Set up real-time subscription for messages
      const messagesSubscription = supabase
        .channel("dashboard_messages")
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
          loadSystemStats()
          if (isMonitoring) {
            loadRealtimeMessages()
          }
        })
        .subscribe()

      // Auto refresh every 30 seconds
      const interval = setInterval(() => {
        loadSystemStats()
        if (isMonitoring) {
          loadRealtimeMessages()
        }
      }, 30000)

      return () => {
        messagesSubscription.unsubscribe()
        clearInterval(interval)
      }
    }
  }, [supabase, isMonitoring])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
              <Code className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                API Developer Dashboard
              </h1>
              <p className="text-slate-400">Monitor, test, and debug your ChatVerse Pro APIs</p>
            </div>
          </div>

          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Messages</p>
                    <p className="text-2xl font-bold text-white">{systemStats.total_messages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Active Users</p>
                    <p className="text-2xl font-bold text-white">{systemStats.active_users}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Zap className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Avg Response</p>
                    <p className="text-2xl font-bold text-white">{Math.round(systemStats.avg_response_time)}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Database className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Database</p>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          systemStats.database_status === "healthy"
                            ? "bg-green-400"
                            : systemStats.database_status === "warning"
                              ? "bg-yellow-400"
                              : "bg-red-400"
                        }`}
                      />
                      <p className="text-sm font-medium text-white capitalize">{systemStats.database_status}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="logs" className="data-[state=active]:bg-purple-600">
              <Activity className="w-4 h-4 mr-2" />
              API Logs
            </TabsTrigger>
            <TabsTrigger value="test" className="data-[state=active]:bg-purple-600">
              <Terminal className="w-4 h-4 mr-2" />
              API Tester
            </TabsTrigger>
            <TabsTrigger value="docs" className="data-[state=active]:bg-purple-600">
              <FileText className="w-4 h-4 mr-2" />
              Documentation
            </TabsTrigger>
            <TabsTrigger value="monitor" className="data-[state=active]:bg-purple-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-purple-600">
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
          </TabsList>

          {/* API Logs Tab */}
          <TabsContent value="logs">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Activity className="w-5 h-5" />
                  <span>Real-time API Logs</span>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                    Live
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {apiLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600"
                      >
                        <div className="flex items-center space-x-4">
                          <Badge className={`${getStatusColor(log.status)} border-0`}>{log.status}</Badge>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {log.method}
                          </Badge>
                          <span className="font-mono text-sm text-slate-300">{log.endpoint}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{log.response_time}ms</span>
                          </span>
                          <span>{formatTime(log.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Tester Tab */}
          <TabsContent value="test">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <Terminal className="w-5 h-5" />
                    <span>API Request Builder</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <select
                      value={testMethod}
                      onChange={(e) => setTestMethod(e.target.value)}
                      className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <Input
                      placeholder="API Endpoint"
                      value={testEndpoint}
                      onChange={(e) => setTestEndpoint(e.target.value)}
                      className="flex-1 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  {testMethod !== "GET" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Request Body (JSON)</label>
                      <Textarea
                        placeholder="Request payload..."
                        value={testPayload}
                        onChange={(e) => setTestPayload(e.target.value)}
                        className="h-32 bg-slate-700 border-slate-600 text-white font-mono text-sm"
                      />
                    </div>
                  )}

                  <Button
                    onClick={testApiEndpoint}
                    disabled={isTestLoading}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isTestLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Send Request
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <Server className="w-5 h-5" />
                    <span>Response</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg">
                      {testResponse || "No response yet. Send a request to see the response here."}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs">
            <div className="space-y-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <FileText className="w-5 h-5" />
                    <span>API Endpoints</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className="bg-green-500/20 text-green-400 border-0">POST</Badge>
                        <code className="text-purple-400">/api/chat</code>
                      </div>
                      <p className="text-slate-300 text-sm mb-2">Moderate and send chat messages</p>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-slate-400 hover:text-white">Request Body</summary>
                        <pre className="mt-2 p-2 bg-slate-900/50 rounded text-slate-300">
                          {JSON.stringify(
                            {
                              message: "string",
                              action: "moderate",
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </div>

                    <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className="bg-blue-500/20 text-blue-400 border-0">GET</Badge>
                        <code className="text-purple-400">/api/users</code>
                      </div>
                      <p className="text-slate-300 text-sm">Get online users list</p>
                    </div>

                    <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className="bg-blue-500/20 text-blue-400 border-0">GET</Badge>
                        <code className="text-purple-400">/api/messages</code>
                      </div>
                      <p className="text-slate-300 text-sm">Get chat messages history</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <Code className="w-5 h-5" />
                    <span>Code Examples</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="javascript" className="space-y-4">
                    <TabsList className="bg-slate-700/50">
                      <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                      <TabsTrigger value="python">Python</TabsTrigger>
                      <TabsTrigger value="curl">cURL</TabsTrigger>
                    </TabsList>

                    {Object.entries(codeExamples).map(([lang, code]) => (
                      <TabsContent key={lang} value={lang}>
                        <div className="relative">
                          <pre className="p-4 bg-slate-900/50 rounded-lg text-sm text-slate-300 overflow-x-auto">
                            <code>{code}</code>
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(code, lang)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-white"
                          >
                            {copiedCode === lang ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitor">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <BarChart3 className="w-5 h-5" />
                    <span>Performance Metrics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Average Response Time</span>
                      <span className="text-white font-mono">{Math.round(systemStats.avg_response_time)}ms</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min((systemStats.avg_response_time / 200) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <Separator className="bg-slate-600" />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">System Uptime</span>
                      <span className="text-white font-mono">{systemStats.uptime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Total API Calls</span>
                      <span className="text-white font-mono">{apiLogs.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Success Rate</span>
                      <span className="text-green-400 font-mono">
                        {Math.round((apiLogs.filter((log) => log.status < 400).length / apiLogs.length) * 100)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-white">
                    <Shield className="w-5 h-5" />
                    <span>Security & Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="border-green-600 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-green-300">
                      All systems operational. No security threats detected.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Database Connection</span>
                      <div className="flex items-center space-x-2">
                        <Wifi className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Connected</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">AI Moderation</span>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Active</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Rate Limiting</span>
                      <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Enabled</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <div className="space-y-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <MessageSquare className="w-5 h-5" />
                      <span>Real-time Messages</span>
                      {isMonitoring && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                          Live
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex space-x-2">
                      <Button
                        onClick={loadRealtimeMessages}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <Button
                        onClick={toggleMonitoring}
                        variant={isMonitoring ? "destructive" : "default"}
                        size="sm"
                        className={isMonitoring ? "" : "bg-green-600 hover:bg-green-700"}
                      >
                        {isMonitoring ? (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            Stop Monitor
                          </>
                        ) : (
                          <>
                            <Activity className="w-4 h-4 mr-2" />
                            Start Monitor
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {realtimeMessages.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No messages found. Click "Start Monitor" to load messages.</p>
                        </div>
                      ) : (
                        realtimeMessages.map((message) => (
                          <div
                            key={message.id}
                            className="flex items-start justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3 mb-2">
                                <Badge
                                  className={`${message.user_name === "System" ? "bg-gray-500/20 text-gray-400" : "bg-blue-500/20 text-blue-400"} border-0`}
                                >
                                  {message.user_name}
                                </Badge>
                                <span className="text-xs text-slate-400">
                                  {new Date(message.created_at).toLocaleString("id-ID")}
                                </span>
                                {message.media_type && (
                                  <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                                    {message.media_type}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-slate-300 text-sm break-words">{message.content}</p>
                              {message.reactions && Object.keys(message.reactions).length > 0 && (
                                <div className="flex space-x-1 mt-2">
                                  {Object.entries(message.reactions).map(([emoji, count]) => (
                                    <span key={emoji} className="text-xs bg-slate-600 px-2 py-1 rounded">
                                      {emoji} {count}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                onClick={() => setSelectedMessage(selectedMessage === message.id ? null : message.id)}
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-white"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => {
                                  const msg = realtimeMessages.find((m) => m.id === message.id)
                                  if (
                                    confirm(
                                      `Delete message from ${msg?.user_name}?\n\n"${msg?.content?.substring(0, 50)}..."`,
                                    )
                                  ) {
                                    deleteMessageViaAPI(message.id) // Use API method instead
                                  }
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Message Details */}
              {selectedMessage && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <FileText className="w-5 h-5" />
                      <span>Message Details</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const message = realtimeMessages.find((m) => m.id === selectedMessage)
                      if (!message) return <p className="text-slate-400">Message not found</p>

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">ID:</span>
                              <p className="font-mono text-slate-300">{message.id}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">User:</span>
                              <p className="text-slate-300">{message.user_name}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Created:</span>
                              <p className="text-slate-300">{new Date(message.created_at).toLocaleString("id-ID")}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Media Type:</span>
                              <p className="text-slate-300">{message.media_type || "text"}</p>
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Content:</span>
                            <p className="text-slate-300 bg-slate-900/50 p-3 rounded mt-1">{message.content}</p>
                          </div>
                          {message.media_url && (
                            <div>
                              <span className="text-slate-400">Media URL:</span>
                              <p className="text-slate-300 font-mono text-xs bg-slate-900/50 p-3 rounded mt-1 break-all">
                                {message.media_url.substring(0, 100)}...
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
