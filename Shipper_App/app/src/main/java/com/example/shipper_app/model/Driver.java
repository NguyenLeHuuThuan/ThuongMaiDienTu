package com.example.shipper_app.model;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * Model Driver (Shipper) - ánh xạ với bảng Driver trong ERD
 */
public class Driver implements Serializable {

    // Trạng thái tài xế
    public enum DriverStatus {
        ONLINE("Online"),
        OFFLINE("Offline"),
        BUSY("Đang giao");

        private final String displayName;

        DriverStatus(String displayName) {
            this.displayName = displayName;
        }

        public String getDisplayName() {
            return displayName;
        }
    }

    // ====== Trường từ ERD ======
    private int idDriver;
    private int idUser;
    private String licensePlate;        // license_plate
    private String vehicleType;         // cuu_Front (hình ảnh xe)
    private String drivingLicense;      // driving_License
    private BigDecimal currentLat;      // current_Lat
    private BigDecimal currentLng;      // current_Lng (hiểu là Lng từ ERD)
    private boolean isOnline;           // is_Online
    private boolean isDelete;
    private float ratingAvg;            // rating_Avg
    private int totalOrders;            // total_Orders

    // ====== Trường bổ sung từ JOIN User ======
    private String fullName;
    private String phone;
    private String avatar;

    // ====== Constructor ======

    public Driver() {}

    public Driver(int idDriver, String fullName, String phone, String licensePlate,
                  boolean isOnline, float ratingAvg) {
        this.idDriver = idDriver;
        this.fullName = fullName;
        this.phone = phone;
        this.licensePlate = licensePlate;
        this.isOnline = isOnline;
        this.ratingAvg = ratingAvg;
    }

    // ====== Getters & Setters ======

    public int getIdDriver() { return idDriver; }
    public void setIdDriver(int idDriver) { this.idDriver = idDriver; }

    public int getIdUser() { return idUser; }
    public void setIdUser(int idUser) { this.idUser = idUser; }

    public String getLicensePlate() { return licensePlate; }
    public void setLicensePlate(String licensePlate) { this.licensePlate = licensePlate; }

    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }

    public String getDrivingLicense() { return drivingLicense; }
    public void setDrivingLicense(String drivingLicense) { this.drivingLicense = drivingLicense; }

    public BigDecimal getCurrentLat() { return currentLat; }
    public void setCurrentLat(BigDecimal currentLat) { this.currentLat = currentLat; }

    public BigDecimal getCurrentLng() { return currentLng; }
    public void setCurrentLng(BigDecimal currentLng) { this.currentLng = currentLng; }

    public boolean isOnline() { return isOnline; }
    public void setOnline(boolean online) { isOnline = online; }

    public boolean isDelete() { return isDelete; }
    public void setDelete(boolean delete) { isDelete = delete; }

    public float getRatingAvg() { return ratingAvg; }
    public void setRatingAvg(float ratingAvg) { this.ratingAvg = ratingAvg; }

    public int getTotalOrders() { return totalOrders; }
    public void setTotalOrders(int totalOrders) { this.totalOrders = totalOrders; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    /**
     * Lấy trạng thái hiển thị
     */
    public DriverStatus getStatus() {
        return isOnline ? DriverStatus.ONLINE : DriverStatus.OFFLINE;
    }

    /**
     * Lấy chữ đầu tên để hiển thị avatar
     */
    public String getInitial() {
        if (fullName != null && !fullName.isEmpty()) {
            String[] parts = fullName.split(" ");
            if (parts.length > 0) {
                return String.valueOf(parts[parts.length - 1].charAt(0)).toUpperCase();
            }
        }
        return "S";
    }
}
