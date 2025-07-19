import { database } from "./firebase-config"
import { ref, push, onValue, off, serverTimestamp, query, orderByChild, limitToLast, set } from "firebase/database"

export interface Message {
  id: string
  text: string
  sender: string
  timestamp: number
  type?: "text" | "image" | "file"
}

export class ChatService {
  private static instance: ChatService
  private listeners: Map<string, any> = new Map()

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService()
    }
    return ChatService.instance
  }

  // Send a message to a chat
  async sendMessage(chatId: string, message: Omit<Message, "id" | "timestamp">): Promise<void> {
    try {
      const messagesRef = ref(database, `chats/${chatId}/messages`)
      await push(messagesRef, {
        ...message,
        timestamp: serverTimestamp(),
      })
    } catch (error) {
      console.error("Failed to send message:", error)
      throw error
    }
  }

  // Listen to messages in a chat
  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void): () => void {
    const messagesRef = ref(database, `chats/${chatId}/messages`)
    const messagesQuery = query(messagesRef, orderByChild("timestamp"), limitToLast(100))

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const messagesList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value,
        }))
        callback(messagesList.sort((a, b) => a.timestamp - b.timestamp))
      } else {
        callback([])
      }
    })

    this.listeners.set(chatId, unsubscribe)

    return () => {
      off(messagesRef, "value", unsubscribe)
      this.listeners.delete(chatId)
    }
  }

  // Update user's last seen
  async updateLastSeen(userId: string): Promise<void> {
    try {
      const userRef = ref(database, `users/${userId}/lastSeen`)
      await push(userRef, serverTimestamp())
    } catch (error) {
      console.error("Failed to update last seen:", error)
    }
  }

  // Create or get chat metadata
  async initializeChat(chatId: string, participants: string[]): Promise<void> {
    try {
      const chatRef = ref(database, `chats/${chatId}/metadata`)
      await push(chatRef, {
        participants,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      })
    } catch (error) {
      console.error("Failed to initialize chat:", error)
    }
  }

  // Set typing status for a user in a chat
  setTypingStatus(chatId: string, userId: string, isTyping: boolean): void {
    const typingRef = ref(database, `chats/${chatId}/typing/${userId}`)
    // Set to true/false, and auto-remove after 3 seconds if true
    if (isTyping) {
      set(typingRef, true)
      setTimeout(() => set(typingRef, false), 3000)
    } else {
      set(typingRef, false)
    }
  }

  // Subscribe to typing status of the other user
  subscribeToTyping(chatId: string, friendId: string, callback: (isTyping: boolean) => void): () => void {
    const typingRef = ref(database, `chats/${chatId}/typing/${friendId}`)
    const unsubscribe = onValue(typingRef, (snapshot) => {
      callback(!!snapshot.val())
    })
    return () => off(typingRef, "value", unsubscribe)
  }

  // Clean up all listeners
  cleanup(): void {
    this.listeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") {
        unsubscribe()
      }
    })
    this.listeners.clear()
  }
}

export const chatService = ChatService.getInstance()
