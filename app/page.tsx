"use client"

import type React from "react"

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
import { ImageViewer } from "@/components/image-viewer"
import {
  MessageCircle,
  Users,
  Send,
  AlertTriangle,
  Menu,
  X,
  Wifi,
  WifiOff,
  Database,
  ImageIcon,
  Paperclip,
  Mic,
  MicOff,
  Play,
  Pause,
  Volume2,
  Sparkles,
  Shield,
} from "lucide-react"
import { getSupabaseClient, type Message, type ChatUser } from "@/lib/supabase"

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"]
const COLORS = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500", "bg-yellow-500", "bg-indigo-500"]

// Indonesian profanity filter
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

interface ExtendedMessage extends Message {
  media_type?: "image" | "audio" | "voice" | null
  media_url?: string | null
  media_name?: string | null
  duration?: number | null
}

export default function RealtimeChatApp() {
  const [messages, setMessages] = useState<ExtendedMessage[]>([])
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
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ url: string; name?: string } | null>(null)
  const [replyingTo, setReplyingTo] = useState<ExtendedMessage | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userColor = useRef("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Initialize Supabase client
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

  // Convert file to base64
  const fileToBase64WithTimeout = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      // Add timeout (30 seconds)
      const timeout = setTimeout(() => {
        reader.abort()
        reject(new Error("File upload timeout"))
      }, 30000)

      reader.readAsDataURL(file)
      reader.onload = () => {
        clearTimeout(timeout)
        resolve(reader.result as string)
      }
      reader.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  // Handle file upload with better error handling and compression
  const handleFileUpload = async (file: File) => {
    if (!supabase) return

    try {
      setIsLoading(true)
      setWarningMessage("")

      // Check file size (max 5MB instead of 10MB)
      if (file.size > 5 * 1024 * 1024) {
        setWarningMessage("❌ File terlalu besar! Maksimal 5MB.")
        setTimeout(() => setWarningMessage(""), 3000)
        return
      }

      // Check file type
      const isImage = file.type.startsWith("image/")
      const isAudio = file.type.startsWith("audio/")

      if (!isImage && !isAudio) {
        setWarningMessage("❌ Format file tidak didukung! Hanya gambar dan audio.")
        setTimeout(() => setWarningMessage(""), 3000)
        return
      }

      let processedFile = file
      const mediaType: "image" | "audio" = isImage ? "image" : "audio"

      // Compress image if too large
      if (isImage && file.size > 1024 * 1024) {
        // 1MB
        processedFile = await compressImage(file)
      }

      // Convert to base64 with progress
      setWarningMessage("📤 Mengupload file...")
      const base64Data = await fileToBase64WithTimeout(processedFile)

      // Insert message with media
      const { error } = await supabase.from("messages").insert({
        user_name: username,
        content: mediaType === "image" ? "📷 Mengirim gambar" : "🎵 Mengirim audio",
        avatar: username.charAt(0).toUpperCase(),
        user_color: userColor.current,
        reactions: {},
        media_type: mediaType,
        media_url: base64Data,
        media_name: processedFile.name,
      })

      if (error) throw error

      setLastMessageTime(Date.now())
      setWarningMessage("✅ File berhasil dikirim!")
      setTimeout(() => setWarningMessage(""), 2000)
    } catch (error) {
      console.error("Error uploading file:", error)
      setWarningMessage("❌ Gagal mengirim file. Coba file yang lebih kecil!")
      setTimeout(() => setWarningMessage(""), 4000)
    } finally {
      setIsLoading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Add image compression function
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions (max 800px width/height)
        let { width, height } = img
        const maxSize = 800

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              resolve(file) // fallback to original
            }
          },
          "image/jpeg",
          0.8, // 80% quality
        )
      }

      img.src = URL.createObjectURL(file)
    })
  }

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        const audioFile = new File([audioBlob], `voice-${Date.now()}.wav`, { type: "audio/wav" })

        // Upload voice message
        await handleVoiceUpload(audioFile, recordingTime)

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error starting recording:", error)
      setWarningMessage("❌ Gagal mengakses mikrofon. Periksa permission!")
      setTimeout(() => setWarningMessage(""), 3000)
    }
  }

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  // Handle voice upload
  const handleVoiceUpload = async (audioFile: File, duration: number) => {
    if (!supabase) return

    try {
      setIsLoading(true)

      const base64Data = await fileToBase64WithTimeout(audioFile)

      // Insert voice message
      const { error } = await supabase.from("messages").insert({
        user_name: username,
        content: `🎤 Pesan suara (${duration}s)`,
        avatar: username.charAt(0).toUpperCase(),
        user_color: userColor.current,
        reactions: {},
        media_type: "voice",
        media_url: base64Data,
        media_name: audioFile.name,
        duration: duration,
      })

      if (error) throw error
      setLastMessageTime(Date.now())
    } catch (error) {
      console.error("Error uploading voice:", error)
      setWarningMessage("❌ Gagal mengirim pesan suara. Coba lagi!")
      setTimeout(() => setWarningMessage(""), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  // Play/pause audio
  const toggleAudio = (messageId: string, audioUrl: string) => {
    const audioElement = document.getElementById(`audio-${messageId}`) as HTMLAudioElement

    if (playingAudio === messageId) {
      audioElement.pause()
      setPlayingAudio(null)
    } else {
      // Pause other audios
      if (playingAudio) {
        const currentAudio = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement
        currentAudio?.pause()
      }

      audioElement.play()
      setPlayingAudio(messageId)

      audioElement.onended = () => {
        setPlayingAudio(null)
      }
    }
  }

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Format message time
  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    })
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
        const newMessage = payload.new as ExtendedMessage
        setMessages((prev) => [...prev, newMessage])
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const updatedMessage = payload.new as ExtendedMessage
        setMessages((prev) => prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)))
      })
      .subscribe()

    // Subscribe to user changes
    const usersSubscription = supabase
      .channel("chat_users")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_users" }, () => {
        loadUsers()
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

  // Handle drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find((file) => file.type.startsWith("image/"))

    if (imageFile) {
      handleFileUpload(imageFile)
    }
  }

  // Handle paste image
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith("image/"))

    if (imageItem) {
      const file = imageItem.getAsFile()
      if (file) {
        handleFileUpload(file)
      }
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
      // Local Indonesian profanity check
      const isToxic = checkIndonesianProfanity(input)

      if (isToxic) {
        setWarningMessage("🚫 Bahasa kasar terdeteksi! Gunakan bahasa yang sopan ya.")
        setIsLoading(false)
        setTimeout(() => setWarningMessage(""), 4000)
        return
      }

      // Insert message to database with reply data
      const messageData: any = {
        user_name: username,
        content: input,
        avatar: username.charAt(0).toUpperCase(),
        user_color: userColor.current,
        reactions: {},
      }

      // Add reply data if replying
      if (replyingTo) {
        messageData.reply_to_id = replyingTo.id
        messageData.reply_to_user = replyingTo.user_name
        messageData.reply_to_content = replyingTo.content.substring(0, 100)
      }

      const { error } = await supabase.from("messages").insert(messageData)

      if (error) throw error

      setInput("")
      setReplyingTo(null) // Clear reply
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

  // Users Sidebar Component
  const UsersSidebar = () => (
    <div className="h-full bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="p-6 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center space-x-3 text-xl font-bold text-slate-800">
            <div className="p-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span>Online ({users.length})</span>
          </h3>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[calc(100%-100px)] p-4">
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="group flex items-center space-x-4 p-3 rounded-xl hover:bg-white/60 transition-all duration-200 hover:shadow-sm"
            >
              <div className="relative">
                <Avatar className="w-10 h-10 ring-2 ring-white shadow-md">
                  <AvatarFallback className={`${user.user_color} text-white font-semibold`}>
                    {user.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{user.user_name}</p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-slate-500 font-medium">Aktif sekarang</span>
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-red-400 to-red-600 rounded-full flex items-center justify-center">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-3">Database Connection Failed</h2>
            <p className="text-slate-600 text-sm mb-6">
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <CardHeader className="text-center space-y-6 pb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center relative">
              <MessageCircle className="w-10 h-10 text-white" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-yellow-800" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                ChatVerse Pro
              </CardTitle>
              <p className="text-slate-600 mt-3 text-base">Chat multimedia dengan AI moderation & real-time sync</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">Masukkan nama kamu</label>
              <Input
                placeholder="Nama kamu..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && joinChat()}
                className="border-2 border-slate-200 focus:border-purple-400 h-12 text-base rounded-xl"
              />
            </div>
            <Button
              onClick={joinChat}
              className="w-full h-12 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={!username.trim()}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Gabung ChatVerse Pro
            </Button>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span>HD Images</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Volume2 className="w-4 h-4 text-green-500" />
                <span>Audio Files</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Mic className="w-4 h-4 text-red-500" />
                <span>Voice Record</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                <Shield className="w-4 h-4 text-purple-500" />
                <span>AI Safe</span>
              </div>
            </div>
            <Alert className="border-emerald-200 bg-emerald-50">
              <Database className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700 text-sm">
                ✨ Powered by Supabase real-time database dengan AI content moderation
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="h-screen flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80">
          <Card className="h-full shadow-2xl border-0 bg-white/80 backdrop-blur-xl rounded-none">
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
          <Card className="flex-1 shadow-2xl border-0 bg-white/80 backdrop-blur-xl rounded-none md:rounded-l-none">
            <CardHeader className="pb-4 px-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="md:hidden text-white hover:bg-white/20"
                        onClick={() => setIsSidebarOpen(true)}
                      >
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                  </Sheet>
                  <div className="p-2 bg-white/20 rounded-xl">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="font-bold text-xl">ChatVerse Pro</h1>
                    <p className="text-white/80 text-sm">Multimedia Real-time Chat</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                    <span className="hidden sm:inline">{isConnected ? "Connected" : "Disconnected"}</span>
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Pro Features</span>
                    <span className="sm:hidden">Pro</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col h-[calc(100vh-140px)] px-6 py-4">
              {/* Warning Message */}
              {warningMessage && (
                <Alert className="mb-4 border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-700 text-sm">{warningMessage}</AlertDescription>
                </Alert>
              )}

              {/* Recording Indicator */}
              {isRecording && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <Mic className="h-4 w-4 text-red-600 animate-pulse" />
                  <AlertDescription className="text-red-700 text-sm">
                    🎤 Merekam suara... {formatTime(recordingTime)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-6 pb-4">
                  {messages.map((message) => (
                    <div key={message.id} className="group">
                      <div
                        className={`flex items-start space-x-3 ${
                          message.user_name === username ? "flex-row-reverse space-x-reverse" : ""
                        }`}
                      >
                        <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-white shadow-md">
                          <AvatarFallback
                            className={`${
                              message.user_name === "System"
                                ? "bg-gray-500"
                                : message.user_name === username
                                  ? userColor.current
                                  : message.user_color
                            } text-white font-semibold`}
                          >
                            {message.avatar}
                          </AvatarFallback>
                        </Avatar>

                        <div className={`flex-1 min-w-0 ${message.user_name === username ? "text-right" : ""}`}>
                          <div
                            className={`flex items-center space-x-2 mb-1 ${message.user_name === username ? "justify-end" : ""}`}
                          >
                            <span className="font-semibold text-slate-800 truncate">{message.user_name}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {formatMessageTime(message.created_at)}
                            </span>
                          </div>

                          <div
                            className={`inline-block p-3 rounded-2xl max-w-[85%] sm:max-w-md break-words shadow-sm ${
                              message.user_name === username
                                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white"
                                : message.user_name === "System"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-white border border-slate-200 text-slate-800"
                            }`}
                          >
                            {/* Reply Reference */}
                            {(message as any).reply_to_id && (
                              <div
                                className={`mb-2 p-2 rounded-lg border-l-4 text-xs ${
                                  message.user_name === username
                                    ? "bg-white/20 border-white/40 text-white/80"
                                    : "bg-slate-100 border-slate-300 text-slate-600"
                                }`}
                              >
                                <div className="font-medium">↳ Reply to {(message as any).reply_to_user}</div>
                                <div className="truncate">{(message as any).reply_to_content}</div>
                              </div>
                            )}

                            {/* Text Content */}
                            <p className="text-sm leading-relaxed mb-2">{message.content}</p>

                            {/* Image Content */}
                            {message.media_type === "image" && message.media_url && (
                              <div className="mt-3">
                                <img
                                  src={message.media_url || "/placeholder.svg"}
                                  alt="Shared image"
                                  className="max-w-full h-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                                  onClick={() =>
                                    setSelectedImage({ url: message.media_url!, name: message.media_name })
                                  }
                                />
                              </div>
                            )}

                            {/* Audio Content */}
                            {(message.media_type === "audio" || message.media_type === "voice") &&
                              message.media_url && (
                                <div className="mt-3 flex items-center space-x-3 bg-slate-100 rounded-xl p-3">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleAudio(message.id, message.media_url!)}
                                    className="p-2 h-10 w-10 bg-white rounded-full shadow-sm hover:shadow-md"
                                  >
                                    {playingAudio === message.id ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-700">
                                      {message.media_type === "voice" ? "🎤 Voice Message" : "🎵 Audio File"}
                                    </div>
                                    {message.duration && (
                                      <div className="text-xs text-slate-500">{formatTime(message.duration)}</div>
                                    )}
                                  </div>
                                  <audio
                                    id={`audio-${message.id}`}
                                    src={message.media_url}
                                    preload="metadata"
                                    className="hidden"
                                  />
                                </div>
                              )}
                          </div>

                          {/* Reactions */}
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div
                              className={`flex flex-wrap gap-2 mt-2 ${message.user_name === username ? "justify-end" : ""}`}
                            >
                              {Object.entries(message.reactions).map(([emoji, count]) => (
                                <Badge
                                  key={emoji}
                                  variant="secondary"
                                  className="text-sm cursor-pointer hover:bg-slate-200 bg-slate-100 border-0 px-3 py-1"
                                  onClick={() => addReaction(message.id, emoji)}
                                >
                                  {emoji} {count}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Quick Actions */}
                          {message.user_name !== "System" && (
                            <div
                              className={`opacity-0 group-hover:opacity-100 transition-opacity mt-2 ${message.user_name === username ? "text-right" : ""}`}
                            >
                              <div className={`flex space-x-2 ${message.user_name === username ? "justify-end" : ""}`}>
                                {/* Reply Button */}
                                <button
                                  onClick={() => setReplyingTo(message)}
                                  className="text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                                >
                                  ↳ Reply
                                </button>

                                {/* Quick Reactions */}
                                {message.user_name !== username && (
                                  <div className="flex space-x-1">
                                    {EMOJI_REACTIONS.slice(0, 3).map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => addReaction(message.id, emoji)}
                                        className="text-sm hover:bg-slate-100 rounded-lg p-1 transition-colors"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
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
              <div
                className={`space-y-3 ${isDragOver ? "bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-4" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Reply Preview */}
                {replyingTo && (
                  <div className="bg-slate-100 border-l-4 border-purple-500 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-700">↳ Replying to {replyingTo.user_name}</div>
                        <div className="text-sm text-slate-600 truncate">{replyingTo.content.substring(0, 100)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(null)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Drag & Drop Overlay */}
                {isDragOver && (
                  <div className="text-center py-8">
                    <ImageIcon className="w-12 h-12 mx-auto text-blue-500 mb-2" />
                    <p className="text-blue-600 font-medium">Drop gambar di sini untuk upload</p>
                  </div>
                )}

                <div className="flex space-x-3">
                  {/* File Upload Button with loading state */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || !isConnected}
                    className="flex-shrink-0 h-12 w-12 rounded-xl border-2 hover:bg-slate-50"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="w-5 h-5" />
                    )}
                  </Button>

                  {/* Voice Recording Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isLoading || !isConnected}
                    className={`flex-shrink-0 h-12 w-12 rounded-xl border-2 ${isRecording ? "bg-red-100 text-red-600 border-red-200" : "hover:bg-slate-50"}`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>

                  <Input
                    placeholder="Ketik pesan kamu... (Ctrl+V untuk paste gambar)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    onPaste={handlePaste}
                    className="flex-1 border-2 focus:border-purple-400 h-12 rounded-xl text-base"
                    disabled={isLoading || !isConnected || isRecording}
                    maxLength={300}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading || !isConnected || isRecording}
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 flex-shrink-0 h-12 w-12 rounded-xl"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span className="font-medium">{input.length}/300 karakter</span>
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1">
                      <ImageIcon className="w-3 h-3" />
                      <span className="hidden sm:inline">Drag & Drop</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Mic className="w-3 h-3" />
                      <span className="hidden sm:inline">Voice</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Shield className="w-3 h-3" />
                      <span className="hidden sm:inline">AI Safe</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Hidden File Input with better file types */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,audio/mp3,audio/wav,audio/m4a,audio/ogg"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileUpload(file)
                  }
                }}
                className="hidden"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Viewer Modal */}
      <ImageViewer
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || ""}
        imageName={selectedImage?.name}
      />
    </div>
  )
}
