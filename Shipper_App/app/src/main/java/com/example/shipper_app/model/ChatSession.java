package com.example.shipper_app.model;

public class ChatSession {
    private String name;
    private String time;
    private String lastMessage;
    private boolean isUnread;
    private String orderId;
    private int avatarResId;
    private boolean isCustomer;
    private int partnerId;

    public ChatSession(String name, String time, String lastMessage, boolean isUnread, String orderId, int avatarResId, boolean isCustomer, int partnerId) {
        this.name = name;
        this.time = time;
        this.lastMessage = lastMessage;
        this.isUnread = isUnread;
        this.orderId = orderId;
        this.avatarResId = avatarResId;
        this.isCustomer = isCustomer;
        this.partnerId = partnerId;
    }

    public int getPartnerId() { return partnerId; }

    public String getName() { return name; }
    public String getTime() { return time; }
    public String getLastMessage() { return lastMessage; }
    public boolean isUnread() { return isUnread; }
    public String getOrderId() { return orderId; }
    public int getAvatarResId() { return avatarResId; }
    public boolean isCustomer() { return isCustomer; }
}
