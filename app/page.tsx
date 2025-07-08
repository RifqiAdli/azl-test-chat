"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  MessageCircle,
  Users,
  Shield,
  Send,
  AlertTriangle,
  Heart,
  Menu,
  X,
  Wifi,
  WifiOff,
  Database,
} from "lucide-react"
import { getSupabaseClient, type Message, type ChatUser } from "@/lib/supabase"

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"]
const COLORS = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500", "bg-yellow-500", "bg-indigo-500"]

// bhs kotor
const INDONESIAN_BAD_WORDS = [
  "anjing",
  "babi",
  "bangsat",
  "kontol",
  "memek",
  "tai",
  "sial",
  "brengsek",
  "kampret",
  "tolol",
  "goblok",
  "idiot",
  "bodoh",
  "sialan",
  "bajingan",
  "asu",
  "jancuk",
  "cuk",
  "puki",
  "perek",
  "lonte",
  "pelacur",
]

export default function RealtimeChatApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [username, setUsername] = useState("")
  const [isJoined, setIsJoined] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastMessageTime, setLastMessageTime] = useState(0)
  const [warningMessage, setWarningMessage] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userColor = useRef("")

  // inisialisasi supabase grrrrr
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)

  useEffect(() => {
    try {
      const client = getSupabaseClient()
      setSupabase(client)
      setIsConnected(true)
    } catch (error) {
      console.error("Failed to initialize Supabase:", error)
      setWarningMessage("❌ Koneksi database gagal. Periksa environment variables.")
    }
  }, [])

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Generate user avatar color
  const generateUserColor = (name: string) => {
    const index = name.length % COLORS.length
    return COLORS[index]
  }

  // Enhanced Indonesian profanity check
  const checkIndonesianProfanity = (text: string) => {
    const lowerText = text.toLowerCase()
    return INDONESIAN_BAD_WORDS.some(
      (word) =>
        lowerText.includes(word) ||
        lowerText.includes(word.replace(/[aeiou]/g, "*")) ||
        lowerText.includes(word.split("").join("*")),
    )
  }

  // Enhanced anti-spam check
  const checkSpam = () => {
    const now = Date.now()
    const timeDiff = now - lastMessageTime

    if (timeDiff < 1500) {
      setWarningMessage("⚠️ Pelan-pelan ya! Tunggu sebentar sebelum mengirim pesan lagi.")
      return true
    }

    if (input.length > 300) {
      setWarningMessage("⚠️ Pesan terlalu panjang! Maksimal 300 karakter.")
      return true
    }

    // Check for excessive caps
    const capsCount = (input.match(/[A-Z]/g) || []).length
    if (capsCount > input.length * 0.7 && input.length > 10) {
      setWarningMessage("⚠️ Jangan terlalu banyak huruf kapital!")
      return true
    }

    // Check Indonesian profanity locally first
    if (checkIndonesianProfanity(input)) {
      setWarningMessage("🚫 Bahasa kasar terdeteksi! Gunakan bahasa yang sopan ya.")
      return true
    }

    return false
  }

  // Content moderation with AI
  const moderateContent = async (message: string) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, action: "moderate" }),
      })

      const result = await response.json()
      return result.isToxic
    } catch (error) {
      console.error("Moderation error:", error)
      return checkIndonesianProfanity(message)
    }
  }

  // Load initial messages
  const loadMessages = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100)

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  // Load online users
  const loadUsers = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from("chat_users")
        .select("*")
        .eq("is_online", true)
        .order("created_at", { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error("Error loading users:", error)
    }
  }

  // Update user online status
  const updateUserStatus = async (isOnline: boolean) => {
    if (!currentUserId || !supabase) return

    try {
      const { error } = await supabase
        .from("chat_users")
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq("id", currentUserId)

      if (error) throw error
    } catch (error) {
      console.error("Error updating user status:", error)
    }
  }

  // Setup real-time subscriptions
  useEffect(() => {
    if (!isJoined || !supabase) return

    loadMessages()
    loadUsers()

    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMessage = payload.new as Message
        setMessages((prev) => [...prev, newMessage])
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updatedMessage = payload.new as Message
        setMessages((prev) => prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)))
      })
      .subscribe()

    // Subscribe to user changes
    const usersSubscription = supabase
      .channel("chat_users")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_users" }, () => {
        loadUsers() // Reload users on any change
      })
      .subscribe()

    // Handle page visibility for online status
    const handleVisibilityChange = () => {
      updateUserStatus(!document.hidden)
    }

    const handleBeforeUnload = () => {
      updateUserStatus(false)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)

    // Cleanup on unmount
    return () => {
      messagesSubscription.unsubscribe()
      usersSubscription.unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      updateUserStatus(false)
    }
  }, [isJoined, currentUserId, supabase])

  const joinChat = async () => {
    if (!username.trim() || !supabase) return

    try {
      userColor.current = generateUserColor(username)

      // Insert or update user in database
      const { data, error } = await supabase
        .from("chat_users")
        .upsert(
          {
            user_name: username,
            avatar: username.charAt(0).toUpperCase(),
            user_color: userColor.current,
            is_online: true,
            last_seen: new Date().toISOString(),
          },
          {
            onConflict: "user_name",
          },
        )
        .select()
        .single()

      if (error) throw error

      setCurrentUserId(data.id)
      setIsJoined(true)

      // Send welcome message
      await supabase.from("messages").insert({
        user_name: "System",
        content: `🎉 ${username} bergabung ke chat room!`,
        avatar: "🤖",
        user_color: "bg-gray-500",
        reactions: {},
      })
    } catch (error) {
      console.error("Error joining chat:", error)
      setWarningMessage("❌ Gagal bergabung ke chat. Coba lagi!")
      setTimeout(() => setWarningMessage(""), 3000)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !supabase) return

    // Enhanced spam and profanity check
    if (checkSpam()) {
      setTimeout(() => setWarningMessage(""), 3000)
      return
    }

    setIsLoading(true)
    setWarningMessage("")

    try {
      // AI Content moderation for advanced detection
      const isToxic = await moderateContent(input)

      if (isToxic) {
        setWarningMessage("🚫 Pesan mengandung konten yang tidak pantas. Mari jaga suasana tetap positif!")
        setIsLoading(false)
        setTimeout(() => setWarningMessage(""), 4000)
        return
      }

      // Insert message to database
      const { error } = await supabase.from("messages").insert({
        user_name: username,
        content: input,
        avatar: username.charAt(0).toUpperCase(),
        user_color: userColor.current,
        reactions: {},
      })

      if (error) throw error

      setInput("")
      setLastMessageTime(Date.now())
    } catch (error) {
      console.error("Error sending message:", error)
      setWarningMessage("❌ Gagal mengirim pesan. Coba lagi!")
      setTimeout(() => setWarningMessage(""), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const addReaction = async (messageId: string, emoji: string) => {
    if (!supabase) return

    try {
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      const newReactions = { ...message.reactions }
      newReactions[emoji] = (newReactions[emoji] || 0) + 1

      const { error } = await supabase.from("messages").update({ reactions: newReactions }).eq("id", messageId)

      if (error) throw error
    } catch (error) {
      console.error("Error adding reaction:", error)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Users Sidebar Component
  const UsersSidebar = () => (
    <div className="h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center space-x-2 text-lg font-semibold">
            <Users className="w-5 h-5 text-green-500" />
            <span>Online ({users.length})</span>
          </h3>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[calc(100%-80px)] p-4">
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
              <Avatar className="w-8 h-8">
                <AvatarFallback className={`${user.user_color} text-white text-sm`}>{user.avatar}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.user_name}</p>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-gray-500">Online</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )

  if (!supabase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <Database className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold text-red-600 mb-2">Database Connection Failed</h2>
            <p className="text-gray-600 text-sm mb-4">
              Supabase environment variables tidak ditemukan. Silakan setup terlebih dahulu.
            </p>
            <Alert className="border-red-200 bg-red-50 text-left">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700 text-xs">
                Pastikan file .env.local sudah dibuat dengan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Real-Time Hangout Chat
              </CardTitle>
              <p className="text-gray-600 mt-2 text-sm">Chat real-time dengan Supabase Database</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nama kamu</label>
              <Input
                placeholder="Masukkan nama..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && joinChat()}
                className="border-2 focus:border-purple-400"
              />
            </div>
            <Button
              onClick={joinChat}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={!username.trim()}
            >
              Gabung Chat Real-Time 🚀
            </Button>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>Anti-Toxic AI</span>
              </div>
              <div className="flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Anti-Spam</span>
              </div>
              <div className="flex items-center space-x-1">
                <Heart className="w-3 h-3" />
                <span>Bahasa Sopan</span>
              </div>
              <div className="flex items-center space-x-1">
                <Database className="w-3 h-3" />
                <span>Supabase DB</span>
              </div>
            </div>
            <Alert className="border-green-200 bg-green-50">
              <Database className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 text-xs">
                ✅ Terhubung ke Supabase! Chat akan sync real-time di semua device.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="h-screen flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80">
          <Card className="h-full shadow-xl border-0 bg-white/80 backdrop-blur-sm rounded-none">
            <UsersSidebar />
          </Card>
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <UsersSidebar />
          </SheetContent>
        </Sheet>

        {/* Main Chat */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 shadow-xl border-0 bg-white/80 backdrop-blur-sm rounded-none md:rounded-l-none">
            <CardHeader className="pb-3 px-4 md:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsSidebarOpen(true)}>
                        <Menu className="w-4 h-4" />
                      </Button>
                    </SheetTrigger>
                  </Sheet>
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-lg">Real-Time Chat</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                    <span className="hidden sm:inline">{isConnected ? "Connected" : "Disconnected"}</span>
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Moderasi AI</span>
                    <span className="sm:hidden">AI</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col h-[calc(100vh-120px)] px-4 md:px-6">
              {/* Warning Message */}
              {warningMessage && (
                <Alert className="mb-4 border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-700 text-sm">{warningMessage}</AlertDescription>
                </Alert>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-4 pb-4">
                  {messages.map((message) => (
                    <div key={message.id} className="group">
                      <div
                        className={`flex items-start space-x-3 ${
                          message.user_name === username ? "flex-row-reverse space-x-reverse" : ""
                        }`}
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarFallback
                            className={`${
                              message.user_name === "System"
                                ? "bg-gray-500"
                                : message.user_name === username
                                  ? userColor.current
                                  : message.user_color
                            } text-white text-sm`}
                          >
                            {message.avatar}
                          </AvatarFallback>
                        </Avatar>

                        <div className={`flex-1 min-w-0 ${message.user_name === username ? "text-right" : ""}`}>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm text-gray-700 truncate">{message.user_name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatTime(message.created_at)}
                            </span>
                          </div>

                          <div
                            className={`inline-block p-3 rounded-2xl max-w-[85%] sm:max-w-md break-words ${
                              message.user_name === username
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                                : message.user_name === "System"
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-white border border-gray-200 text-gray-800 shadow-sm"
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          </div>

                          {/* Reactions */}
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.entries(message.reactions).map(([emoji, count]) => (
                                <Badge
                                  key={emoji}
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-gray-200"
                                  onClick={() => addReaction(message.id, emoji)}
                                >
                                  {emoji} {count}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Quick Reactions */}
                          {message.user_name !== username && message.user_name !== "System" && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                              <div className="flex space-x-1">
                                {EMOJI_REACTIONS.slice(0, 4).map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => addReaction(message.id, emoji)}
                                    className="text-sm hover:bg-gray-100 rounded p-1 transition-colors"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              {/* Message Input */}
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Ketik pesan..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    className="flex-1 border-2 focus:border-purple-400"
                    disabled={isLoading || !isConnected}
                    maxLength={300}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading || !isConnected}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 flex-shrink-0"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{input.length}/300</span>
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <span className="flex items-center space-x-1">
                      {isConnected ? (
                        <Wifi className="w-3 h-3 text-green-500" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-red-500" />
                      )}
                      <span className="hidden sm:inline">{isConnected ? "Real-time" : "Offline"}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Shield className="w-3 h-3" />
                      <span className="hidden sm:inline">AI Moderation</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Heart className="w-3 h-3" />
                      <span className="hidden sm:inline">Safe Space</span>
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
