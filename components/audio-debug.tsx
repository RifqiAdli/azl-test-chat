"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, Speaker, Headphones } from "lucide-react"

export function AudioDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<string>("")

  const runAudioDiagnostics = async () => {
    let info = "🔍 Audio Diagnostics:\n\n"

    try {
      // Check audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        const audioContext = new AudioContext()
        info += `✅ AudioContext: ${audioContext.state}\n`
        info += `🔊 Sample Rate: ${audioContext.sampleRate}Hz\n`
        await audioContext.close()
      } else {
        info += "❌ AudioContext not supported\n"
      }

      // Check media devices
      if (navigator.mediaDevices) {
        info += "✅ MediaDevices API available\n"

        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const audioInputs = devices.filter((d) => d.kind === "audioinput")
          const audioOutputs = devices.filter((d) => d.kind === "audiooutput")

          info += `🎤 Audio inputs: ${audioInputs.length}\n`
          info += `🔊 Audio outputs: ${audioOutputs.length}\n`

          audioInputs.forEach((device, i) => {
            info += `  Input ${i + 1}: ${device.label || "Unknown"}\n`
          })
        } catch (error) {
          info += `❌ Device enumeration failed: ${error.message}\n`
        }

        // Test microphone access
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          info += "✅ Microphone access granted\n"

          const tracks = stream.getAudioTracks()
          if (tracks.length > 0) {
            const track = tracks[0]
            info += `🎤 Track label: ${track.label}\n`
            info += `🎤 Track state: ${track.readyState}\n`
            info += `🎤 Track settings: ${JSON.stringify(track.getSettings(), null, 2)}\n`
          }

          stream.getTracks().forEach((track) => track.stop())
        } catch (error) {
          info += `❌ Microphone access failed: ${error.message}\n`
        }
      } else {
        info += "❌ MediaDevices API not available\n"
      }

      // Check WebRTC support
      if (window.RTCPeerConnection) {
        info += "✅ WebRTC supported\n"
      } else {
        info += "❌ WebRTC not supported\n"
      }

      // Check autoplay policy
      try {
        const audio = new Audio()
        const playPromise = audio.play()
        if (playPromise) {
          await playPromise
          info += "✅ Autoplay allowed\n"
        }
      } catch (error) {
        info += `⚠️ Autoplay blocked: ${error.message}\n`
      }
    } catch (error) {
      info += `❌ Diagnostics failed: ${error.message}\n`
    }

    setDebugInfo(info)
  }

  const testAudioPlayback = async () => {
    try {
      // Create a test tone
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.5)

      alert("🔊 Test tone played! Did you hear it?")
    } catch (error) {
      alert(`❌ Audio test failed: ${error.message}`)
    }
  }

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Headphones className="w-5 h-5" />
          <span>Audio Debug Panel</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={runAudioDiagnostics}
            variant="outline"
            size="sm"
            className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white bg-transparent"
          >
            <Mic className="w-4 h-4 mr-2" />
            Run Diagnostics
          </Button>
          <Button
            onClick={testAudioPlayback}
            variant="outline"
            size="sm"
            className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white bg-transparent"
          >
            <Speaker className="w-4 h-4 mr-2" />
            Test Audio
          </Button>
        </div>

        {debugInfo && (
          <div className="bg-gray-800 p-3 rounded text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {debugInfo}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
