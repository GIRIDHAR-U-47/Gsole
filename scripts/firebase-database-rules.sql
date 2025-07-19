-- Firebase Realtime Database Security Rules
-- Copy this to your Firebase Console > Realtime Database > Rules

{
  "rules": {
    "chats": {
      "$chatId": {
        ".read": true,
        ".write": true,
        "messages": {
          "$messageId": {
            ".validate": "newData.hasChildren(['text', 'sender', 'timestamp', 'type'])",
            "text": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"
            },
            "sender": {
              ".validate": "newData.isString() && newData.val().length == 12"
            },
            "type": {
              ".validate": "newData.isString() && (newData.val() == 'text' || newData.val() == 'image' || newData.val() == 'file')"
            },
            "timestamp": {
              ".validate": "newData.val() == now"
            }
          }
        },
        "metadata": {
          ".validate": "newData.hasChildren(['participants', 'createdAt'])",
          "participants": {
            ".validate": "newData.isString()"
          }
        }
      }
    },
    "users": {
      "$userId": {
        ".read": true,
        ".write": "$userId == auth.uid || auth == null",
        "lastSeen": {
          ".validate": "newData.val() == now"
        }
      }
    }
  }
}
