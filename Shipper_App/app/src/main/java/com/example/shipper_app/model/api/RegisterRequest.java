package com.example.shipper_app.model.api;

public class RegisterRequest {
    private String fullName;
    private String phone;
    private String email;
    private String password;
    private String license_plate;

    public RegisterRequest(String fullName, String phone, String email, String password, String license_plate) {
        this.fullName = fullName;
        this.phone = phone;
        this.email = email;
        this.password = password;
        this.license_plate = license_plate;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getLicense_plate() {
        return license_plate;
    }

    public void setLicense_plate(String license_plate) {
        this.license_plate = license_plate;
    }
}
