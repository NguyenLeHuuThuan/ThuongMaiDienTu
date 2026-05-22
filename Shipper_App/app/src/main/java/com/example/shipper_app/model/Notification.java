package com.example.shipper_app.model;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;
import java.util.Date;

public class Notification implements Serializable {
    @SerializedName("id_Noti")
    private int idNoti;

    @SerializedName("id_User")
    private int idUser;

    @SerializedName("title")
    private String title;

    @SerializedName("body")
    private String body;

    @SerializedName("type")
    private String type;

    @SerializedName("is_Read")
    private boolean isRead;

    @SerializedName("related_OrderId")
    private Integer relatedOrderId;

    @SerializedName("created_At")
    private Date createdAt;

    public Notification() {}

    public int getIdNoti() {
        return idNoti;
    }

    public void setIdNoti(int idNoti) {
        this.idNoti = idNoti;
    }

    public int getIdUser() {
        return idUser;
    }

    public void setIdUser(int idUser) {
        this.idUser = idUser;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public boolean isRead() {
        return isRead;
    }

    public void setRead(boolean read) {
        isRead = read;
    }

    public Integer getRelatedOrderId() {
        return relatedOrderId;
    }

    public void setRelatedOrderId(Integer relatedOrderId) {
        this.relatedOrderId = relatedOrderId;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
