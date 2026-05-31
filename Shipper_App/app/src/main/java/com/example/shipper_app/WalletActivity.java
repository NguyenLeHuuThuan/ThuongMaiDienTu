package com.example.shipper_app;

import android.content.DialogInterface;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.example.shipper_app.adapter.WalletAdapter;
import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.api.ApiResponse;
import com.example.shipper_app.model.Order;
import com.example.shipper_app.model.WalletResponse;
import com.example.shipper_app.model.WalletTransaction;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class WalletActivity extends AppCompatActivity {

    private ImageView btnBack;
    private TextView tvWalletBalance;
    private Button btnDeposit, btnWithdraw;
    private RecyclerView rvTransactions;
    
    private WalletAdapter walletAdapter;
    private List<WalletTransaction> transactionList = new ArrayList<>();
    
    private ApiService apiService;

    private android.os.Handler pollingHandler;
    private Runnable pollingRunnable;
    private static final int POLLING_INTERVAL = 3000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_wallet);

        apiService = ApiClient.getClient(this).create(ApiService.class);

        btnBack = findViewById(R.id.btn_back);
        tvWalletBalance = findViewById(R.id.tv_wallet_balance);
        btnDeposit = findViewById(R.id.btn_deposit);
        btnWithdraw = findViewById(R.id.btn_withdraw);
        rvTransactions = findViewById(R.id.rv_transactions);

        rvTransactions.setLayoutManager(new LinearLayoutManager(this));
        walletAdapter = new WalletAdapter(this, transactionList);
        rvTransactions.setAdapter(walletAdapter);

        btnBack.setOnClickListener(v -> finish());

        btnDeposit.setOnClickListener(v -> showAmountDialog("Nạp tiền", true));
        btnWithdraw.setOnClickListener(v -> showAmountDialog("Rút tiền", false));

        fetchWalletData(true);

        pollingHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                fetchWalletData(false);
                pollingHandler.postDelayed(this, POLLING_INTERVAL);
            }
        };
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchWalletData(true);
        if (pollingHandler != null) {
            pollingHandler.postDelayed(pollingRunnable, POLLING_INTERVAL);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (pollingHandler != null) {
            pollingHandler.removeCallbacks(pollingRunnable);
        }
    }

    private void fetchWalletData() {
        fetchWalletData(true);
    }

    private void fetchWalletData(boolean showErrors) {
        apiService.getWallet().enqueue(new Callback<WalletResponse>() {
            @Override
            public void onResponse(Call<WalletResponse> call, Response<WalletResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Double balance = response.body().getWalletBalance();
                    tvWalletBalance.setText(Order.formatCurrency(java.math.BigDecimal.valueOf(balance != null ? balance : 0)));
                    
                    transactionList.clear();
                    if (response.body().getTransactions() != null) {
                        transactionList.addAll(response.body().getTransactions());
                    }
                    walletAdapter.notifyDataSetChanged();
                } else {
                    if (showErrors) {
                        Toast.makeText(WalletActivity.this, "Không thể lấy thông tin ví", Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<WalletResponse> call, Throwable t) {
                if (showErrors) {
                    Toast.makeText(WalletActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void showAmountDialog(String title, boolean isDeposit) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(title);
        
        final EditText input = new EditText(this);
        input.setHint("Nhập số tiền (đ)");
        input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        builder.setView(input);

        builder.setPositiveButton("Xác nhận", (dialog, which) -> {
            String amountStr = input.getText().toString().trim();
            if (!amountStr.isEmpty()) {
                try {
                    double amount = Double.parseDouble(amountStr);
                    if (amount > 0) {
                        processTransaction(amount, isDeposit);
                    } else {
                        Toast.makeText(this, "Số tiền không hợp lệ", Toast.LENGTH_SHORT).show();
                    }
                } catch (NumberFormatException e) {
                    Toast.makeText(this, "Số tiền không hợp lệ", Toast.LENGTH_SHORT).show();
                }
            }
        });
        builder.setNegativeButton("Hủy", (dialog, which) -> dialog.cancel());

        builder.show();
    }

    private void processTransaction(double amount, boolean isDeposit) {
        Map<String, Double> request = new HashMap<>();
        request.put("amount", amount);
        
        Call<ApiResponse> call;
        if (isDeposit) {
            call = apiService.depositWallet(request);
        } else {
            call = apiService.withdrawWallet(request);
        }
        
        call.enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(WalletActivity.this, "Giao dịch thành công", Toast.LENGTH_SHORT).show();
                    fetchWalletData(); // Refresh data
                } else {
                    try {
                        String errorMsg = "Giao dịch thất bại (Có thể do số dư không đủ)";
                        if (response.errorBody() != null) {
                            String errorBodyStr = response.errorBody().string();
                            org.json.JSONObject errorJson = new org.json.JSONObject(errorBodyStr);
                            if (errorJson.has("message")) {
                                errorMsg = errorJson.getString("message");
                            }
                        }
                        Toast.makeText(WalletActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(WalletActivity.this, "Giao dịch thất bại", Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Toast.makeText(WalletActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
