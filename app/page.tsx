"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, MessageSquare, Copy, Check } from "lucide-react"
import ChatScreen from "./components/chat-screen"
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { useToast } from "@/components/ui/use-toast"
import { chatService } from "@/lib/chat-service"

interface Friend {
  id: string
  chatId: string
}

export default function TerminalChatApp() {
  const { toast } = useToast()

  // Request notification permission and register service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
              console.log('ServiceWorker registration successful');
            })
            .catch(err => {
              console.error('ServiceWorker registration failed:', err);
            });
        }
      });
    }
  }, []);
  const [userToken, setUserToken] = useState<string>("")
  const [friendInput, setFriendInput] = useState<string>("")
  const [friends, setFriends] = useState<Friend[]>([])
  const [currentChat, setCurrentChat] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Generate unique user token on first launch
  useEffect(() => {
    const getFingerprint = async () => {
      let token = localStorage.getItem("userToken")
      if (!token) {
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        token = result.visitorId.toUpperCase().slice(0, 12) // 12-char, uppercase for theme match
        localStorage.setItem("userToken", token)
      }
      setUserToken(token)

      // Load friends from localStorage
      const savedFriends = localStorage.getItem("friends")
      if (savedFriends) {
        setFriends(JSON.parse(savedFriends))
      }
    }
    getFingerprint()
  }, [])

  const createChatId = (user1: string, user2: string): string => {
    return [user1, user2].sort().join("_")
  }

  const addFriend = () => {
    if (!friendInput.trim() || friendInput === userToken) return

    // Initialize chat service for the new connection
    const chatId = createChatId(userToken, friendInput)
    chatService.initializeChat(chatId, [userToken, friendInput]).catch(error => {
      console.error('Failed to initialize chat:', error)
      toast({
        title: "Connection Failed",
        description: "Failed to establish connection. Please try again.",
        variant: "destructive"
      })
      return
    })

    // Show browser notification for new friend
    if (Notification.permission === 'granted') {
      new Notification('New Friend Added', {
        body: `${friendInput} has been added to your friends list`,
        icon: '/icon.png'
      });
    }

    const newFriend: Friend = {
      id: friendInput,
      chatId,
    }

    const updatedFriends = [...friends, newFriend]
    setFriends(updatedFriends)
    localStorage.setItem("friends", JSON.stringify(updatedFriends))
    setFriendInput("")
    // Show both toast and browser notification
    toast({
      title: "New Friend Added",
      description: `${friendInput} has been added to your friends list`,
      duration: 3000,
      variant: "success"
    });

    if (Notification.permission === 'granted') {
      new Notification('New Friend Added', {
        body: `${friendInput} has been added to your friends list`,
        icon: '/icon.png'
      });
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(userToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      console.log('Showing toast for ID copy');
      toast({
        title: "ID Copied",
        description: "Your ID has been copied to clipboard",
        duration: 2000,
        variant: "success"
      });
      if (Notification.permission === 'granted') {
        new Notification('ID Copied', {
          body: 'Your ID has been copied to clipboard',
          icon: '/icon.png'
        });
      }
      console.log('Toast shown for ID copy');
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const removeFriend = (friendId: string) => {
    const updatedFriends = friends.filter((f) => f.id !== friendId)
    setFriends(updatedFriends)
    localStorage.setItem("friends", JSON.stringify(updatedFriends))
  }

  if (currentChat) {
    const friend = friends.find((f) => f.chatId === currentChat)
    return (
      <ChatScreen
        chatId={currentChat}
        userToken={userToken}
        friendId={friend?.id || ""}
        onBack={() => {
        setCurrentChat(null)
        console.log('Showing toast for chat close');
        toast({
      title: "Chat Closed",
      description: "You've left the current chat",
      duration: 2000,
      variant: "success"
    });
    if (Notification.permission === 'granted') {
      new Notification('Chat Closed', {
        body: "You've left the current chat",
        icon: '/icon.png'
      });
    }

    if (Notification.permission === 'granted') {
      new Notification('Chat Closed', {
        body: "You've left the current chat",
        icon: '/icon.png'
      });
    }
        console.log('Toast shown for chat close');
      }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-green-400 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-4 bg-green-400 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-xl">G</span>
          </div>
          <h1 className="text-2xl font-mono font-bold text-green-400">GSOLE</h1>
          <div className="text-xs text-green-600 mt-2 font-mono">
            {">"} SECURE ENCRYPTED MESSAGING {"<"}
          </div>
        </div>

        {/* User Token Display */}
        <Card className="bg-black border-green-500 border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 font-mono text-sm flex items-center gap-2">
              <span className="w-4 h-4 bg-green-400 rounded-sm"></span>
              YOUR CHAT ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-green-900/20 text-green-400 border-green-500 font-mono text-lg px-4 py-2 flex-1 justify-center"
              >
                {userToken}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="border-green-500 text-green-400 hover:bg-green-900/20 bg-transparent"
                onClick={copyToClipboard}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-green-600 mt-2 font-mono">Share this ID with friends to connect</p>
          </CardContent>
        </Card>

        {/* Add Friend */}
        <Card className="bg-black border-green-500 border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 font-mono text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              ADD FRIEND
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value.toUpperCase())}
                placeholder="ENTER FRIEND'S CHAT ID"
                className="bg-gray-900 border-green-500 text-green-400 font-mono placeholder:text-green-700"
                maxLength={12}
              />
              <Button
                onClick={addFriend}
                className="bg-green-900 hover:bg-green-800 text-green-400 border border-green-500"
                disabled={!friendInput.trim() || friendInput === userToken}
              >
                CONNECT
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Friends List */}
        {friends.length > 0 && (
          <Card className="bg-black border-green-500 border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-400 font-mono text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                ACTIVE CONNECTIONS ({friends.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 bg-gray-900 border border-green-700 rounded cursor-pointer hover:bg-green-900/10 transition-colors"
                  onClick={() => setCurrentChat(friend.chatId)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-mono text-green-400">{friend.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFriend(friend.id)
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Status */}
        <div className="text-center">
          <div className="text-xs text-green-600 font-mono">
            {">"} STATUS: ONLINE {"<"}
          </div>
          <div className="text-xs text-green-700 font-mono mt-1">
            CONNECTIONS: {friends.length} | ENCRYPTION: ACTIVE
          </div>
        </div>
      </div>
    </div>
  )
}
