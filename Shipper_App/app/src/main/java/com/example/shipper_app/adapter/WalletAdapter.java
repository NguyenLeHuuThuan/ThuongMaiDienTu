package com.example.shipper_app.adapter;

import android.content.Context;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.shipper_app.R;
import com.example.shipper_app.model.Order;
import com.example.shipper_app.model.WalletTransaction;
import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Locale;

public class WalletAdapter extends RecyclerView.Adapter<WalletAdapter.ViewHolder> {
    private List<WalletTransaction> transactions;
    private Context context;
    private SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());

    public WalletAdapter(Context context, List<WalletTransaction> transactions) {
        this.context = context;
        this.transactions = transactions;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_wallet_transaction, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        WalletTransaction trans = transactions.get(position);
        
        holder.tvNote.setText(trans.getNote() != null ? trans.getNote() : "Giao dịch ví");
        
        if (trans.getCreatedAt() != null && !trans.getCreatedAt().isEmpty()) {
            try {
                // Parse ISO 8601 string from SQL Server (e.g., "2023-05-31T04:23:01.000Z")
                SimpleDateFormat apiFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
                apiFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                java.util.Date date = apiFormat.parse(trans.getCreatedAt());
                holder.tvTime.setText(sdf.format(date));
            } catch (Exception e) {
                // Fallback parsing if formatting fails
                try {
                    SimpleDateFormat apiFormatFallback = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault());
                    apiFormatFallback.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    java.util.Date date = apiFormatFallback.parse(trans.getCreatedAt());
                    holder.tvTime.setText(sdf.format(date));
                } catch (Exception ex) {
                    holder.tvTime.setText(trans.getCreatedAt().replace("T", " ").substring(0, 16));
                }
            }
        } else {
            holder.tvTime.setText("");
        }

        double amount = trans.getAmount() != null ? trans.getAmount() : 0;
        String sign = amount >= 0 ? "+" : "-";
        holder.tvAmount.setText(sign + " " + Order.formatCurrency(java.math.BigDecimal.valueOf(Math.abs(amount))));
        
        if (amount >= 0) {
            holder.tvAmount.setTextColor(Color.parseColor("#4CAF50")); // Green
        } else {
            holder.tvAmount.setTextColor(Color.parseColor("#F44336")); // Red
        }

        double balanceAfter = trans.getBalanceAfter() != null ? trans.getBalanceAfter() : 0;
        holder.tvBalance.setText("Số dư: " + Order.formatCurrency(java.math.BigDecimal.valueOf(balanceAfter)));
    }

    @Override
    public int getItemCount() {
        return transactions != null ? transactions.size() : 0;
    }

    public static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvNote, tvTime, tvAmount, tvBalance;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvNote = itemView.findViewById(R.id.tv_transaction_note);
            tvTime = itemView.findViewById(R.id.tv_transaction_time);
            tvAmount = itemView.findViewById(R.id.tv_transaction_amount);
            tvBalance = itemView.findViewById(R.id.tv_transaction_balance);
        }
    }
}
