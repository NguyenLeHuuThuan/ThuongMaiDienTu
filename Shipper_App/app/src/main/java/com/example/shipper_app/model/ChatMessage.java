package com.example.shipper_app.model;

public class ChatMessage {
    private String messageText;
    private String time;
    private boolean isSentByMe;

    public ChatMessage(String messageText, String time, boolean isSentByMe) {
        this.messageText = messageText;
        this.time = time;
        this.isSentByMe = isSentByMe;
    }

    public String getMessageText() {
        return messageText;
    }

    public String getTime() {
        return time;
    }

    public boolean isSentByMe() {
        return isSentByMe;
    }
}
