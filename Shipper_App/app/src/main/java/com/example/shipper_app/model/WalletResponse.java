package com.example.shipper_app.model;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class WalletResponse {
    @SerializedName("wallet_balance")
    private Double walletBalance;
    
    @SerializedName("transactions")
    private List<WalletTransaction> transactions;

    public Double getWalletBalance() { return walletBalance; }
    public List<WalletTransaction> getTransactions() { return transactions; }
}
