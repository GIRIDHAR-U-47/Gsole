"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send } from "lucide-react"
import { chatService, type Message } from "../../lib/chat-service"
import { useToast } from "@/components/ui/use-toast"

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
    <div className="min-h-screen bg-black text-green-400 flex flex-col font-mono">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              <div
                className={`p-3 rounded border-2 ${
                  message.sender === userToken
                    ? "bg-green-900/20 border-green-500 text-green-300"
                    : "bg-gray-900 border-green-700 text-green-400"
                }`}
              >
                {">"} {message.text}
              </div>
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
        <div className="flex gap-2">
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
        </div>
        <div className="text-xs text-green-600 mt-2 text-center">
          ENCRYPTION: AES-256 | STATUS: SECURE | PRESS ENTER TO SEND
        </div>
      </div>
    </div>
  )
}
