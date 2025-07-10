"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import {
  Radio,
  Mic,
  MicOff,
  Volume2,
  Users,
  Zap,
  Settings,
  Power,
  Signal,
  MessageSquare,
  Home,
  PhoneCall,
} from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase"
import Link from "next/link"

// Add this import at the top
// Remove this line:
// import { v4 as uuidv4 } from "uuid"

interface RadioUser {
  id: string
  callsign: string
  channel: number
  is_transmitting: boolean
  is_online: boolean
  signal_strength: number
  last_seen: string
  peer_id?: string
}

interface RadioMessage {
  id: string
  callsign: string
  channel: number
  message: string
  message_type: "voice" | "text" | "system"
  timestamp: string
  duration?: number
}

interface PeerConnection {
  id: string
  callsign: string
  connection: RTCPeerConnection
  audioElement: HTMLAudioElement
}

// Add this function after the interfaces
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const RADIO_CHANNELS = [
  { freq: "146.520", name: "Simplex 1", description: "General Chat" },
  { freq: "146.540", name: "Simplex 2", description: "Emergency" },
  { freq: "147.000", name: "Repeater 1", description: "Local Area" },
  { freq: "147.120", name: "Repeater 2", description: "Wide Coverage" },
  { freq: "145.500", name: "Packet", description: "Data Mode" },
  { freq: "144.390", name: "APRS", description: "Position Reports" },
]

// STUN servers for WebRTC
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
]

export default function RadioPage() {
  const [callsign, setCallsign] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [currentChannel, setCurrentChannel] = useState(0)
  const [volume, setVolume] = useState([75])
  const [squelch, setSquelch] = useState([30])
  const [isPTT, setIsPTT] = useState(false)
  const [isTransmitting, setIsTransmitting] = useState(false)
  const [activeUsers, setActiveUsers] = useState<RadioUser[]>([])
  const [radioMessages, setRadioMessages] = useState<RadioMessage[]>([])
  const [signalStrength, setSignalStrength] = useState(85)
  const [batteryLevel, setBatteryLevel] = useState(92)
  const [isPoweredOn, setIsPoweredOn] = useState(false)
  const [textMessage, setTextMessage] = useState("")

  // WebRTC states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peerConnections, setPeerConnections] = useState<Map<string, PeerConnection>>(new Map())
  const [isVoiceConnected, setIsVoiceConnected] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>("")

  const audioContextRef = useRef<AudioContext | null>(null)
  const staticAudioRef = useRef<HTMLAudioElement | null>(null)
  const beepAudioRef = useRef<HTMLAudioElement | null>(null)
  const localAudioRef = useRef<HTMLAudioElement | null>(null)

  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [lastActivity, setLastActivity] = useState<string>("")

  useEffect(() => {
    try {
      const client = getSupabaseClient()
      setSupabase(client)
    } catch (error) {
      console.error("Failed to initialize Supabase:", error)
    }
  }, [])

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContext) {
          audioContextRef.current = new AudioContext()
        }

        // Create audio elements
        staticAudioRef.current = new Audio()
        staticAudioRef.current.loop = true
        staticAudioRef.current.volume = 0.1

        beepAudioRef.current = new Audio()
        beepAudioRef.current.volume = 0.3

        localAudioRef.current = new Audio()
        localAudioRef.current.muted = true // Prevent echo

        generateAudioSounds()
      } catch (error) {
        console.warn("Audio initialization failed:", error)
      }
    }
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isPTT && isConnected && isPoweredOn) {
        event.preventDefault()
        startPTT()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" && isPTT) {
        event.preventDefault()
        stopPTT()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isPTT, isConnected, isPoweredOn])

  const generateAudioSounds = () => {
    if (!audioContextRef.current) return

    try {
      const audioContext = audioContextRef.current

      // Generate beep sound
      const beepBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate)
      const beepData = beepBuffer.getChannelData(0)
      for (let i = 0; i < beepData.length; i++) {
        beepData[i] = Math.sin((2 * Math.PI * 1000 * i) / audioContext.sampleRate) * 0.3
      }

      // Convert to blob URL
      const beepSource = audioContext.createBufferSource()
      beepSource.buffer = beepBuffer
    } catch (error) {
      console.warn("Audio generation failed:", error)
    }
  }

  const playBeep = () => {
    try {
      if (beepAudioRef.current && isPoweredOn) {
        beepAudioRef.current.currentTime = 0
        beepAudioRef.current.play().catch(console.warn)
      }
    } catch (error) {
      console.warn("Beep failed:", error)
    }
  }

  const playStatic = () => {
    try {
      if (staticAudioRef.current && isPoweredOn) {
        staticAudioRef.current.play().catch(console.warn)
      }
    } catch (error) {
      console.warn("Static failed:", error)
    }
  }

  const stopStatic = () => {
    try {
      if (staticAudioRef.current) {
        staticAudioRef.current.pause()
        staticAudioRef.current.currentTime = 0
      }
    } catch (error) {
      console.warn("Stop static failed:", error)
    }
  }

  // Initialize WebRTC for voice communication
  const initializeVoiceConnection = async () => {
    try {
      setLastActivity("Initializing voice connection...")

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      })

      setLocalStream(stream)
      setIsVoiceConnected(true)
      setLastActivity("Voice connection ready")

      // Set up local audio (muted to prevent feedback)
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream
        localAudioRef.current.muted = true
      }

      return stream
    } catch (error) {
      console.error("Failed to initialize voice:", error)
      setLastActivity("Voice initialization failed")
      throw error
    }
  }

  // Create peer connection
  const createPeerConnection = async (targetUserId: string, targetCallsign: string): Promise<RTCPeerConnection> => {
    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    })

    // Add local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
      })
    }

    // Handle remote stream
    const remoteAudio = new Audio()
    remoteAudio.volume = volume[0] / 100

    peerConnection.ontrack = (event) => {
      console.log("Received remote track from:", targetCallsign)
      remoteAudio.srcObject = event.streams[0]
      remoteAudio.play().catch(console.warn)
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate && supabase) {
        // Send ICE candidate via Supabase
        await supabase.from("radio_signaling").insert({
          from_user: currentUserId,
          to_user: targetUserId,
          channel: currentChannel,
          type: "ice-candidate",
          data: JSON.stringify(event.candidate),
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${targetCallsign}:`, peerConnection.connectionState)
      if (peerConnection.connectionState === "connected") {
        setLastActivity(`Voice connected to ${targetCallsign}`)
      }
    }

    // Store peer connection
    const peerInfo: PeerConnection = {
      id: targetUserId,
      callsign: targetCallsign,
      connection: peerConnection,
      audioElement: remoteAudio,
    }

    setPeerConnections((prev) => {
      const newMap = new Map(prev)
      newMap.set(targetUserId, peerInfo)
      return newMap
    })

    return peerConnection
  }

  // Handle WebRTC signaling
  const handleSignaling = async (signalData: any) => {
    try {
      const { from_user, type, data } = signalData

      if (from_user === currentUserId) return // Ignore own signals

      let peerConnection = peerConnections.get(from_user)?.connection

      if (!peerConnection) {
        const fromUser = activeUsers.find((u) => u.id === from_user)
        if (fromUser) {
          peerConnection = await createPeerConnection(from_user, fromUser.callsign)
        }
      }

      if (!peerConnection) return

      switch (type) {
        case "offer":
          await peerConnection.setRemoteDescription(JSON.parse(data))
          const answer = await peerConnection.createAnswer()
          await peerConnection.setLocalDescription(answer)

          // Send answer back
          if (supabase) {
            await supabase.from("radio_signaling").insert({
              from_user: currentUserId,
              to_user: from_user,
              channel: currentChannel,
              type: "answer",
              data: JSON.stringify(answer),
              timestamp: new Date().toISOString(),
            })
          }
          break

        case "answer":
          await peerConnection.setRemoteDescription(JSON.parse(data))
          break

        case "ice-candidate":
          await peerConnection.addIceCandidate(JSON.parse(data))
          break
      }
    } catch (error) {
      console.error("Signaling error:", error)
    }
  }

  // Start voice transmission (PTT)
  const startPTT = async () => {
    if (!isConnected || !isPoweredOn || !isVoiceConnected) return

    setIsPTT(true)
    setIsTransmitting(true)
    setLastActivity("Transmitting voice...")
    playBeep()

    try {
      // Update transmitting status
      if (supabase) {
        await supabase
          .from("radio_users")
          .update({
            is_transmitting: true,
            last_seen: new Date().toISOString(),
          })
          .eq("id", currentUserId)
      }

      // Create offers to all users in the same channel
      for (const user of activeUsers) {
        if (user.id !== currentUserId && user.channel === currentChannel) {
          try {
            let peerConnection = peerConnections.get(user.id)?.connection

            if (!peerConnection) {
              peerConnection = await createPeerConnection(user.id, user.callsign)
            }

            // Create and send offer
            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)

            if (supabase) {
              await supabase.from("radio_signaling").insert({
                from_user: currentUserId,
                to_user: user.id,
                channel: currentChannel,
                type: "offer",
                data: JSON.stringify(offer),
                timestamp: new Date().toISOString(),
              })
            }
          } catch (error) {
            console.error(`Failed to create offer for ${user.callsign}:`, error)
          }
        }
      }

      setLastActivity("Broadcasting voice...")
    } catch (error) {
      console.error("PTT start error:", error)
      setIsPTT(false)
      setIsTransmitting(false)
      setLastActivity("Voice transmission failed")
    }
  }

  // Stop voice transmission
  const stopPTT = async () => {
    if (!isPTT) return

    setIsPTT(false)
    setIsTransmitting(false)
    setLastActivity("Transmission ended")
    playBeep()

    try {
      // Update transmitting status
      if (supabase) {
        await supabase
          .from("radio_users")
          .update({
            is_transmitting: false,
            last_seen: new Date().toISOString(),
          })
          .eq("id", currentUserId)
      }

      setLastActivity("Ready to transmit")
    } catch (error) {
      console.error("PTT stop error:", error)
    }
  }

  // Power on/off radio
  const togglePower = async () => {
    if (isPoweredOn) {
      // Power off
      setIsPoweredOn(false)
      setIsConnected(false)
      setIsVoiceConnected(false)
      stopStatic()

      // Clean up WebRTC connections
      peerConnections.forEach((peer) => {
        peer.connection.close()
        peer.audioElement.pause()
      })
      setPeerConnections(new Map())

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
        setLocalStream(null)
      }
    } else {
      // Power on
      setIsPoweredOn(true)
      playBeep()
      setLastActivity("Radio powered on")
    }
  }

  // Connect to radio network
  const connectToRadio = async () => {
    if (!callsign.trim() || !supabase || !isPoweredOn) return

    setIsLoading(true)
    setConnectionStatus("connecting")
    setLastActivity("Connecting to network...")

    try {
      // Initialize voice connection first
      await initializeVoiceConnection()

      // Generate proper UUID instead of callsign_timestamp
      // Replace this line:
      // const userId = uuidv4() // This generates proper UUID like "123e4567-e89b-12d3-a456-426614174000"
      // With this:
      const userId = generateUUID() // Generate proper UUID without external package
      setCurrentUserId(userId)

      // Insert user into radio users table
      const { error } = await supabase.from("radio_users").upsert(
        {
          id: userId, // Now using proper UUID
          callsign: callsign.toUpperCase(),
          channel: currentChannel,
          is_transmitting: false,
          is_online: true,
          signal_strength: signalStrength,
          last_seen: new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      )

      if (error) throw error

      setIsConnected(true)
      setConnectionStatus("connected")
      setLastActivity("Connected - Voice ready")
      playBeep()

      // Send system message
      await supabase.from("radio_messages").insert({
        callsign: "SYSTEM",
        channel: currentChannel,
        message: `📻 ${callsign} joined channel ${RADIO_CHANNELS[currentChannel].name} with voice capability`,
        message_type: "system",
        timestamp: new Date().toISOString(),
      })

      // Load data
      await Promise.all([loadActiveUsers(), loadRadioMessages()])
      setLastActivity("Ready to transmit")
    } catch (error) {
      console.error("Error connecting to radio:", error)
      setConnectionStatus("disconnected")
      setLastActivity("Connection failed")
      alert(`Connection failed: ${error.message}\n\nPlease allow microphone access and try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  // Load active users
  const loadActiveUsers = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from("radio_users")
        .select("*")
        .eq("channel", currentChannel)
        .eq("is_online", true)
        .gte("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString())

      if (error) throw error
      setActiveUsers(data || [])
    } catch (error) {
      console.error("Error loading users:", error)
    }
  }

  // Load radio messages
  const loadRadioMessages = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from("radio_messages")
        .select("*")
        .eq("channel", currentChannel)
        .order("timestamp", { ascending: false })
        .limit(50)

      if (error) throw error
      setRadioMessages(data?.reverse() || [])
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  // Change channel
  const changeChannel = async (channelIndex: number) => {
    if (!isPoweredOn) return

    setCurrentChannel(channelIndex)
    setLastActivity(`Switching to ${RADIO_CHANNELS[channelIndex].name}...`)
    playBeep()
    playStatic()

    // Close existing peer connections
    peerConnections.forEach((peer) => {
      peer.connection.close()
      peer.audioElement.pause()
    })
    setPeerConnections(new Map())

    setTimeout(() => {
      stopStatic()
      setLastActivity(`Channel ${RADIO_CHANNELS[channelIndex].name} active`)

      if (isConnected && supabase) {
        // Update user channel
        supabase
          .from("radio_users")
          .update({
            channel: channelIndex,
            last_seen: new Date().toISOString(),
          })
          .eq("id", currentUserId)

        Promise.all([loadActiveUsers(), loadRadioMessages()]).then(() => {
          setLastActivity("Ready to transmit")
        })
      }
    }, 300)
  }

  // Send text message
  const sendTextMessage = async () => {
    if (!textMessage.trim() || !isConnected || !supabase) return

    try {
      await supabase.from("radio_messages").insert({
        callsign: callsign,
        channel: currentChannel,
        message: textMessage,
        message_type: "text",
        timestamp: new Date().toISOString(),
      })

      setTextMessage("")
      playBeep()
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  // Real-time subscriptions
  useEffect(() => {
    if (!isConnected || !supabase) return

    // Subscribe to user changes
    const usersSubscription = supabase
      .channel("radio_users_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "radio_users" }, () => {
        loadActiveUsers()
      })
      .subscribe()

    // Subscribe to messages
    const messagesSubscription = supabase
      .channel("radio_messages_channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "radio_messages" }, (payload) => {
        const newMessage = payload.new as RadioMessage
        if (newMessage.channel === currentChannel) {
          setRadioMessages((prev) => [...prev, newMessage])
          if (newMessage.callsign !== callsign) {
            playBeep()
          }
        }
      })
      .subscribe()

    // Subscribe to WebRTC signaling
    const signalingSubscription = supabase
      .channel("radio_signaling_channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "radio_signaling" }, (payload) => {
        const signalData = payload.new
        if (signalData.to_user === currentUserId && signalData.channel === currentChannel) {
          handleSignaling(signalData)
        }
      })
      .subscribe()

    return () => {
      usersSubscription.unsubscribe()
      messagesSubscription.unsubscribe()
      signalingSubscription.unsubscribe()
    }
  }, [isConnected, currentChannel, callsign, supabase, currentUserId])

  // Update volume for all audio elements
  useEffect(() => {
    const volumeLevel = volume[0] / 100
    peerConnections.forEach((peer) => {
      peer.audioElement.volume = volumeLevel
    })
  }, [volume, peerConnections])

  // Simulate signal strength and battery drain
  useEffect(() => {
    if (!isPoweredOn) return

    const interval = setInterval(() => {
      setSignalStrength((prev) => Math.max(20, prev + (Math.random() - 0.5) * 10))
      setBatteryLevel((prev) => Math.max(0, prev - 0.01))
    }, 5000)

    return () => clearInterval(interval)
  }, [isPoweredOn])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up WebRTC connections
      peerConnections.forEach((peer) => {
        peer.connection.close()
        peer.audioElement.pause()
      })

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }

      // Update user status
      if (supabase && currentUserId) {
        supabase.from("radio_users").update({ is_online: false }).eq("id", currentUserId)
      }
    }
  }, [])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  if (!isPoweredOn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black border-gray-800 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-red-600 to-red-800 rounded-full flex items-center justify-center">
              <Power className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Real Radio HT</h2>
            <p className="text-gray-400 mb-6">Professional voice communication system</p>
            <Button
              onClick={togglePower}
              className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold"
            >
              <Power className="w-5 h-5 mr-2" />
              POWER ON
            </Button>
            <div className="mt-6 text-center">
              <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
                <Home className="w-4 h-4 inline mr-1" />
                Kembali ke Chat
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-700 shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center animate-pulse">
              <Radio className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Real Radio HT Network</CardTitle>
            <p className="text-gray-400">Connect with real voice communication</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Call Sign</label>
              <input
                type="text"
                placeholder="YB1ABC"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-center text-lg"
                maxLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Channel</label>
              <select
                value={currentChannel}
                onChange={(e) => setCurrentChannel(Number(e.target.value))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
              >
                {RADIO_CHANNELS.map((channel, index) => (
                  <option key={index} value={index}>
                    {channel.freq} MHz - {channel.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <PhoneCall className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Real Voice Features</span>
              </div>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>• Real-time voice transmission</li>
                <li>• WebRTC peer-to-peer audio</li>
                <li>• Push-to-talk functionality</li>
                <li>• Multi-user voice channels</li>
              </ul>
            </div>

            <Button
              onClick={connectToRadio}
              disabled={!callsign.trim() || isLoading}
              className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold transition-all duration-200 hover:scale-105"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  CONNECTING...
                </>
              ) : (
                <>
                  <PhoneCall className="w-5 h-5 mr-2" />
                  CONNECT WITH VOICE
                </>
              )}
            </Button>

            <div className="flex justify-between items-center pt-4">
              <Button
                onClick={togglePower}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white bg-transparent"
              >
                <Power className="w-4 h-4 mr-1" />
                Power Off
              </Button>
              <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
                <Home className="w-4 h-4 inline mr-1" />
                Back to Chat
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white">
      <div className="container mx-auto p-4 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Real Radio HT</h1>
              <p className="text-sm text-gray-400">Call Sign: {callsign}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Voice Status */}
            <div className="flex items-center space-x-2">
              <PhoneCall className={`w-4 h-4 ${isVoiceConnected ? "text-green-400" : "text-gray-400"}`} />
              <span className="text-xs text-gray-400">{isVoiceConnected ? "Voice Ready" : "Voice Off"}</span>
            </div>

            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-400 animate-pulse"
                    : connectionStatus === "connecting"
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-red-400"
                }`}
              />
              <span className="text-xs text-gray-400 capitalize">{connectionStatus}</span>
            </div>

            {/* Activity Status */}
            {lastActivity && <div className="text-xs text-gray-400 max-w-32 truncate">{lastActivity}</div>}

            {/* Signal Strength */}
            <div className="flex items-center space-x-2">
              <Signal className="w-4 h-4" />
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <div
                    key={bar}
                    className={`w-1 h-4 transition-colors duration-200 ${bar <= Math.floor(signalStrength / 20) ? "bg-green-400" : "bg-gray-600"}`}
                  />
                ))}
              </div>
              <span className="text-xs">{Math.floor(signalStrength)}%</span>
            </div>

            {/* Battery */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-6 h-3 border rounded-sm transition-colors duration-200 ${batteryLevel > 20 ? "border-green-400" : "border-red-400"}`}
              >
                <div
                  className={`h-full rounded-sm transition-all duration-200 ${batteryLevel > 20 ? "bg-green-400" : "bg-red-400"}`}
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>
              <span className="text-xs">{Math.floor(batteryLevel)}%</span>
            </div>

            <Button
              onClick={togglePower}
              variant="outline"
              size="sm"
              className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white bg-transparent transition-colors duration-200"
            >
              <Power className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Channel Selector */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Channels</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {RADIO_CHANNELS.map((channel, index) => (
                <Button
                  key={index}
                  onClick={() => changeChannel(index)}
                  variant={currentChannel === index ? "default" : "outline"}
                  className={`w-full justify-start text-left ${
                    currentChannel === index ? "bg-orange-600 hover:bg-orange-700" : "border-gray-600 hover:bg-gray-800"
                  }`}
                >
                  <div>
                    <div className="font-mono text-sm">{channel.freq} MHz</div>
                    <div className="text-xs text-gray-400">{channel.name}</div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="lg:col-span-2 bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Channel {RADIO_CHANNELS[currentChannel].name}</span>
                </div>
                <Badge variant="secondary" className="bg-orange-600 text-white">
                  {RADIO_CHANNELS[currentChannel].freq} MHz
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-96">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-3">
                  {radioMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.message_type === "system"
                          ? "bg-gray-800 text-gray-400 text-center text-sm"
                          : message.callsign === callsign
                            ? "bg-blue-900 ml-8"
                            : "bg-gray-800 mr-8"
                      }`}
                    >
                      {message.message_type !== "system" && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm font-bold text-orange-400">{message.callsign}</span>
                          <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        {message.message_type === "voice" && <Mic className="w-4 h-4 text-green-400" />}
                        <span className="text-sm">{message.message}</span>
                        {message.duration && <span className="text-xs text-gray-400">({message.duration}s)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Text Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type message..."
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendTextMessage()}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                />
                <Button
                  onClick={sendTextMessage}
                  disabled={!textMessage.trim()}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Controls & Users */}
          <div className="space-y-4">
            {/* PTT Control */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <PhoneCall className="w-5 h-5" />
                  <span>Voice PTT</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onMouseDown={startPTT}
                  onMouseUp={stopPTT}
                  onTouchStart={startPTT}
                  onTouchEnd={stopPTT}
                  className={`w-full h-20 text-xl font-bold transition-all duration-150 ${
                    isPTT
                      ? "bg-red-600 hover:bg-red-700 animate-pulse scale-95"
                      : "bg-green-600 hover:bg-green-700 hover:scale-105"
                  }`}
                  disabled={!isConnected || !isVoiceConnected || isLoading}
                >
                  {isPTT ? (
                    <>
                      <MicOff className="w-8 h-8 mr-2 animate-pulse" />
                      TRANSMITTING
                    </>
                  ) : isLoading ? (
                    <>
                      <div className="w-8 h-8 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      CONNECTING...
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8 mr-2" />
                      HOLD TO TALK
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 mt-2">
                  {isVoiceConnected ? "Hold button or SPACEBAR for real voice" : "Voice connection required"}
                </p>
              </CardContent>
            </Card>

            {/* Volume Controls */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm">Audio Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Volume2 className="w-4 h-4" />
                    <span className="text-sm">Volume: {volume[0]}%</span>
                  </div>
                  <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-full" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm">Squelch: {squelch[0]}%</span>
                  </div>
                  <Slider value={squelch} onValueChange={setSquelch} max={100} step={1} className="w-full" />
                </div>
              </CardContent>
            </Card>

            {/* Active Users */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Active ({activeUsers.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {activeUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-orange-400">{user.callsign}</span>
                        <div className="flex items-center space-x-1">
                          {user.is_transmitting && <Mic className="w-3 h-3 text-red-400 animate-pulse" />}
                          <PhoneCall className="w-3 h-3 text-green-400" />
                          <div className="flex space-x-1">
                            {[1, 2, 3].map((bar) => (
                              <div
                                key={bar}
                                className={`w-1 h-2 ${
                                  bar <= Math.floor(user.signal_strength / 33) ? "bg-green-400" : "bg-gray-600"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-4 flex justify-center">
          <Link href="/">
            <Button
              variant="outline"
              className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white bg-transparent"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Back to Chat Room
            </Button>
          </Link>
        </div>
      </div>

      {/* Hidden audio elements */}
      <audio ref={localAudioRef} style={{ display: "none" }} />
    </div>
  )
}
