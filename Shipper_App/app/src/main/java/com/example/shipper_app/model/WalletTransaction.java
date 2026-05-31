package com.example.shipper_app.model;

import com.google.gson.annotations.SerializedName;
import java.util.Date;

public class WalletTransaction {
    @SerializedName("id_Transaction")
    private int idTransaction;
    
    @SerializedName("id_Order")
    private Integer idOrder;
    
    @SerializedName("transaction_type")
    private String transactionType;
    
    @SerializedName("amount")
    private Double amount;
    
    @SerializedName("balance_before")
    private Double balanceBefore;
    
    @SerializedName("balance_after")
    private Double balanceAfter;
    
    @SerializedName("note")
    private String note;
    
    @SerializedName("created_At")
    private String createdAt;

    public int getIdTransaction() { return idTransaction; }
    public Integer getIdOrder() { return idOrder; }
    public String getTransactionType() { return transactionType; }
    public Double getAmount() { return amount; }
    public Double getBalanceBefore() { return balanceBefore; }
    public Double getBalanceAfter() { return balanceAfter; }
    public String getNote() { return note; }
    public String getCreatedAt() { return createdAt; }
}
