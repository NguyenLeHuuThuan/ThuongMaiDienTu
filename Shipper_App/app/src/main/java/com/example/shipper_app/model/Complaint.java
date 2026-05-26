package com.example.shipper_app.model;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class Complaint implements Serializable {
    @SerializedName("id_Complaint")
    private int idComplaint;

    @SerializedName("id_Order")
    private int idOrder;

    @SerializedName("type")
    private String type;

    @SerializedName("description")
    private String description;

    @SerializedName("status")
    private String status;

    @SerializedName("resolution")
    private String resolution;

    @SerializedName("image")
    private String image;

    @SerializedName("video")
    private String video;

    @SerializedName("created_At")
    private String createdAt;

    // These fields might be joined from other tables
    @SerializedName("order_Status")
    private String orderStatus;

    @SerializedName("name_Restaurant")
    private String nameRestaurant;

    @SerializedName("user_name")
    private String userName; // Cho "Khiếu nại của tôi"

    @SerializedName("complainant_name")
    private String complainantName; // Cho "Khiếu nại về tôi"

    public int getIdComplaint() {
        return idComplaint;
    }

    public int getIdOrder() {
        return idOrder;
    }

    public String getType() {
        return type;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public String getResolution() {
        return resolution;
    }

    public String getImage() {
        return image;
    }

    public String getVideo() {
        return video;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getOrderStatus() {
        return orderStatus;
    }

    public String getNameRestaurant() {
        return nameRestaurant;
    }

    public String getUserName() {
        return userName;
    }

    public String getComplainantName() {
        return complainantName;
    }
}
