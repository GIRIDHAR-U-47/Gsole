-- Firebase Realtime Database Rules
-- Copy this to your Firebase Console > Realtime Database > Rules

{
  "rules": {
    "chats": {
      "$chatId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['text', 'sender', 'timestamp'])",
        "text": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 1000"
        },
        "sender": {
          ".validate": "newData.isString() && newData.val().length == 12"
        },
        "timestamp": {
          ".validate": "newData.val() == now"
        }
      }
    }
  }
}
