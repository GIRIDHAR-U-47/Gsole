"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send, Mic, Image as ImageIcon } from "lucide-react"
import { chatService, type Message } from "../../lib/chat-service"
import { useToast } from "@/components/ui/use-toast"
import WaveSurfer from 'wavesurfer.js'

interface ChatScreenProps {
  chatId: string
  userToken: string
  friendId: string
  onBack: () => void
}

export default function ChatScreen({ chatId, userToken, friendId, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [friendTyping, setFriendTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [queuedMessages, setQueuedMessages] = useState<Message[]>([])
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus()

    // Initialize chat
    chatService.initializeChat(chatId, [userToken, friendId])

    // Subscribe to messages
    const unsubscribe = chatService.subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages)
    })

    // Subscribe to friend's typing status
    const unsubscribeTyping = chatService.subscribeToTyping(chatId, friendId, setFriendTyping)

    return () => {
      unsubscribe()
      unsubscribeTyping()
    }
  }, [chatId, userToken, friendId])

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Debug: log all messages
  useEffect(() => {
    console.log("Messages:", messages)
  }, [messages])

  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const message = {
      text: inputMessage,
      sender: userToken,
      type: "text" as const,
    }

    if (!navigator.onLine) {
      toast({ title: "Offline", description: "You are offline. Message will be sent when back online.", variant: "destructive" })
      // Queue message for later
      setQueuedMessages((prev) => [...prev, { ...message, id: Date.now().toString(), timestamp: Date.now() }])
      setInputMessage("")
      return
    }

    try {
      await chatService.sendMessage(chatId, message)
      setInputMessage("")
      setIsTyping(true)
      setTimeout(() => setIsTyping(false), 1000)
    } catch (error) {
      toast({ title: "Send Failed", description: "Message failed to send. Will retry when online.", variant: "destructive" })
      setQueuedMessages((prev) => [...prev, { ...message, id: Date.now().toString(), timestamp: Date.now() }])
      setInputMessage("")
    }
  }

  const saveToLocalStorage = (message: Omit<Message, "id">) => {
    const newMessage = { ...message, id: Date.now().toString() }
    const updatedMessages = [...messages, newMessage]
    setMessages(updatedMessages)
    localStorage.setItem(`chat_${chatId}`, JSON.stringify(updatedMessages))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value)
    chatService.setTypingStatus(chatId, userToken, true)
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Retry queued messages when back online
  useEffect(() => {
    const handleOnline = async () => {
      if (queuedMessages.length > 0) {
        for (const msg of queuedMessages) {
          try {
            await chatService.sendMessage(chatId, msg)
          } catch (e) {
            // If still fails, keep in queue
            return
          }
        }
        setQueuedMessages([])
        toast({ title: "Back Online", description: "Queued messages sent.", variant: "success" })
      }
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [queuedMessages, chatId, toast])

  // --- AUDIO RECORDING & PROCESSING ---
  const startRecording = async () => {
    if (!navigator.mediaDevices) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Force audio/webm for best compatibility and set high bitrate for clarity
    const recorder = new window.MediaRecorder(stream, { mimeType: 'audio/webm', audioBitsPerSecond: 192000 })
    setMediaRecorder(recorder)
    setAudioChunks([])
    recorder.ondataavailable = (e) => {
      setAudioChunks((prev) => [...prev, e.data])
    }
    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      sendAudioMessage(audioBlob)
    }
    recorder.start()
    setRecording(true)
  }
  const stopRecording = () => {
    mediaRecorder?.stop()
    setRecording(false)
  }
  const processArmyVoiceEffect = async (audioBlob: Blob): Promise<Blob> => {
    // STUB: In production, process with Web Audio API for radio/army effect
    // For now, return original
    return audioBlob
  }
  // Helper to convert Blob/File to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const sendAudioMessage = async (audioBlob: Blob) => {
    const base64 = await blobToBase64(audioBlob)
    const message = {
      audio: base64,
      sender: userToken,
      type: "audio" as const,
    }
    await chatService.sendMessage(chatId, message)
  }

  // --- IMAGE UPLOAD & PROCESSING ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const processedUrl = await processGreenCyberImage(file)
    sendImageMessage(processedUrl)
  }
  const processGreenCyberImage = async (file: File): Promise<string> => {
    // Read file as image
    const img = document.createElement('img')
    const fileDataUrl = await blobToBase64(file)
    img.src = fileDataUrl
    await new Promise((resolve) => { img.onload = resolve })

    // Set pixelation level (lower = more blocky)
    const pixelSize = 8 // adjust for more/less pixelation
    const width = img.naturalWidth
    const height = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // Draw small, then scale up for pixelation
    ctx.drawImage(img, 0, 0, width / pixelSize, height / pixelSize)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(canvas, 0, 0, width / pixelSize, height / pixelSize, 0, 0, width, height)

    // Get pixel data and apply green/threshold effect
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      // Threshold for blocky look
      const on = avg > 80 ? 255 : 0
      // Strong green tint
      data[i] = 0 // R
      data[i + 1] = on // G
      data[i + 2] = 0 // B
      // Keep alpha
    }
    ctx.putImageData(imageData, 0, 0)
    // Return as base64
    return canvas.toDataURL('image/png')
  }
  const sendImageMessage = async (imgBase64: string) => {
    const message = {
      image: imgBase64,
      sender: userToken,
      type: "image" as const,
    }
    await chatService.sendMessage(chatId, message)
  }

  // WhatsApp-style audio player for chat
  function ChatAudioPlayer({ src }: { src: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const wavesurferRef = useRef<WaveSurfer | null>(null)
    const [playing, setPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    useEffect(() => {
      if (!containerRef.current) return
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
      }
      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#22c55e', // green
        progressColor: '#16a34a', // darker green
        barWidth: 2,
        barRadius: 2,
        height: 32,
        cursorColor: '#22c55e',
        normalize: true,
        interact: true,
      })
      wavesurferRef.current = ws
      ws.load(src)
      ws.on('ready', () => {
        setDuration(ws.getDuration())
      })
      ws.on('audioprocess', () => {
        setCurrentTime(ws.getCurrentTime())
      })
      ws.on('interaction', () => {
        setCurrentTime(ws.getCurrentTime())
      })
      ws.on('finish', () => {
        setPlaying(false)
        setCurrentTime(0)
      })
      return () => {
        ws.destroy()
      }
    }, [src])

    const togglePlay = () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.playPause()
        setPlaying((p) => !p)
      }
    }
    const formatTime = (s: number) => {
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      return `${m}:${sec.toString().padStart(2, '0')}`
    }
    return (
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={togglePlay}
          className={`rounded-full w-8 h-8 flex items-center justify-center border border-green-500 bg-black text-green-400 hover:bg-green-900/20 focus:outline-none`}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="3" width="4" height="12" fill="#22c55e"/><rect x="11" y="3" width="4" height="12" fill="#22c55e"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="3,2 15,9 3,16" fill="#22c55e"/></svg>
          )}
        </button>
        <div ref={containerRef} className="flex-1 min-w-0" />
        <span className="text-xs text-green-400 font-mono w-12 text-right">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    )
  }

  if (!friendId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-red-500 font-mono">
        <div>
          <div className="text-lg mb-2">Error: No friend selected for this chat.</div>
          <div className="text-sm">Please return and select a valid friend to start chatting.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-black text-green-400 flex flex-col font-mono">
      {/* Header */}
      <div className="bg-gray-900 border-b-2 border-green-500 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-green-400 hover:bg-green-900/20 p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-center flex-1">
            <div className="text-sm text-green-400">gsole://chat/{friendId}</div>
            <div className="text-xs text-green-600">SECURE CONNECTION ESTABLISHED</div>
          </div>
          <div className="w-5 h-5 bg-green-400 rounded flex items-center justify-center">
            <span className="text-black font-bold text-xs">G</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-green-600 text-sm">
            <div>
              {">"} CHAT INITIALIZED {"<"}
            </div>
            <div className="mt-2">Connection established with {friendId}</div>
            <div className="text-xs mt-1">Start typing to begin secure communication...</div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === userToken ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] ${message.sender === userToken ? "text-right" : "text-left"}`}>
              <div className="text-xs text-green-600 mb-1">
                {message.sender === userToken ? "YOU" : friendId} [{formatTime(message.timestamp)}]
              </div>
              {/* Always render something for audio/image/text */}
              {message.type === "text" && message.text && (
                <div
                  className={`p-3 rounded border-2 ${
                    message.sender === userToken
                      ? "bg-green-900/20 border-green-500 text-green-300"
                      : "bg-gray-900 border-green-700 text-green-400"
                  }`}
                >
                  {">"} {message.text}
                </div>
              )}
              {message.type === "audio" && message.audio && (
                (() => {
                  console.log("Audio src for message", message.id, message.audio?.slice(0, 100));
                  if (typeof message.audio === 'string' && message.audio.startsWith('data:audio')) {
                    return (
                      <div className="p-3 rounded border-2 bg-gray-900 border-green-700 text-green-400 flex flex-col gap-1 items-start">
                        <ChatAudioPlayer src={message.audio} />
                        <span className="text-xs">[AUDIO]</span>
                      </div>
                    )
                  } else {
                    return (
                      <div className="p-3 rounded border-2 bg-gray-900 border-green-700 text-red-400 flex items-center gap-2">
                        [AUDIO DATA INVALID]
                      </div>
                    )
                  }
                })()
              )}
              {message.type === "image" && message.image && (
                <div className="p-3 rounded border-2 bg-gray-900 border-green-700 text-green-400 flex flex-col items-center">
                  <img src={message.image} alt="sent" className="w-48 h-48 object-cover border-2 border-green-500" style={{ filter: 'grayscale(0.2) contrast(1.5) brightness(0.8) hue-rotate(90deg)' }} />
                  <span className="text-xs mt-1">[IMAGE]</span>
                </div>
              )}
              {/* Fallback for unknown/empty messages */}
              {!(message.type === "text" && message.text) && !(message.type === "audio" && message.audio) && !(message.type === "image" && message.image) && (
                <div className="p-3 rounded border-2 bg-gray-900 border-green-700 text-green-400 opacity-60">
                  [UNSUPPORTED MESSAGE]
                </div>
              )}
            </div>
          </div>
        ))}

        {friendTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-900 border-2 border-green-700 p-3 rounded text-green-600">
              {">"} {friendId} is typing<span className="animate-pulse">...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gray-900 border-t-2 border-green-500 p-4">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-400">{">"}</span>
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="bg-black border-green-500 text-green-400 pl-8 font-mono placeholder:text-green-700 focus:border-green-400"
              disabled={!friendId}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-2 h-4 bg-green-400 animate-pulse"></div>
            </div>
          </div>
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || !friendId}
            className="bg-green-900 hover:bg-green-800 text-green-400 border border-green-500 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
          {/* Voice Button */}
          <Button
            onClick={recording ? stopRecording : startRecording}
            className={`border border-green-500 ${recording ? 'bg-red-900 text-red-400' : 'bg-black text-green-400 hover:bg-green-900/20'}`}
            disabled={!friendId}
            type="button"
          >
            <Mic className="w-4 h-4" />
          </Button>
          {/* Image Button */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="border border-green-500 bg-black text-green-400 hover:bg-green-900/20"
            disabled={!friendId}
            type="button"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
        <div className="text-xs text-green-600 mt-2 text-center">
          ENCRYPTION: AES-256 | STATUS: SECURE | PRESS ENTER TO SEND
        </div>
      </div>
    </div>
  )
}
