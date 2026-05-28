package com.example.shipper_app.adapter;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.example.shipper_app.R;
import com.example.shipper_app.model.Complaint;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ComplaintAdapter extends RecyclerView.Adapter<ComplaintAdapter.ComplaintViewHolder> {

    private List<Complaint> complaintList;
    private boolean isMyComplaint;
    private OnComplaintActionListener listener;

    public interface OnComplaintActionListener {
        void onRemoveClick(Complaint complaint);
    }

    public ComplaintAdapter(List<Complaint> complaintList, boolean isMyComplaint, OnComplaintActionListener listener) {
        this.complaintList = complaintList;
        this.isMyComplaint = isMyComplaint;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ComplaintViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_complaint, parent, false);
        return new ComplaintViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ComplaintViewHolder holder, int position) {
        Complaint complaint = complaintList.get(position);
        
        holder.tvOrderId.setText("Đơn hàng #" + complaint.getIdOrder() + " - " + complaint.getNameRestaurant());
        
        // Format date
        String displayDate = complaint.getCreatedAt();
        try {
            SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
            SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());
            Date date = inputFormat.parse(complaint.getCreatedAt());
            if (date != null) {
                displayDate = outputFormat.format(date);
            }
        } catch (ParseException e) {
            e.printStackTrace();
        }
        
        holder.tvDate.setText(displayDate);

        String descPrefix = isMyComplaint ? "Mô tả: " : ("Từ " + complaint.getComplainantName() + ": ");
        holder.tvDescription.setText(descPrefix + complaint.getDescription());

        // Status logic
        String statusText = "Chờ xử lý";
        int statusColor = Color.parseColor("#F57C00"); // Orange for pending
        
        if ("resolved".equalsIgnoreCase(complaint.getStatus())) {
            statusText = "Đã xử lý";
            statusColor = Color.parseColor("#FF6600"); // Green for resolved
            holder.layoutResolution.setVisibility(View.VISIBLE);
            holder.tvResolution.setText(complaint.getResolution() != null ? complaint.getResolution() : "Không có thông tin");
        } else {
            holder.layoutResolution.setVisibility(View.GONE);
        }

        holder.tvStatus.setText(statusText);
        GradientDrawable bgShape = (GradientDrawable) holder.tvStatus.getBackground();
        if(bgShape != null) bgShape.setColor(statusColor);

        holder.itemView.setOnClickListener(v -> {
            android.content.Context context = v.getContext();
            android.content.Intent intent = new android.content.Intent(context, com.example.shipper_app.ComplaintDetailActivity.class);
            intent.putExtra(com.example.shipper_app.ComplaintDetailActivity.EXTRA_COMPLAINT, complaint);
            context.startActivity(intent);
        });

        holder.btnRemove.setOnClickListener(v -> {
            if (listener != null) {
                listener.onRemoveClick(complaint);
            }
        });
    }

    @Override
    public int getItemCount() {
        return complaintList == null ? 0 : complaintList.size();
    }
    
    public void updateData(List<Complaint> newList) {
        this.complaintList = newList;
        notifyDataSetChanged();
    }

    static class ComplaintViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvStatus, tvDate, tvDescription, tvResolution;
        LinearLayout layoutResolution;
        android.widget.ImageButton btnRemove;

        public ComplaintViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tvOrderId);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            tvDate = itemView.findViewById(R.id.tvDate);
            tvDescription = itemView.findViewById(R.id.tvDescription);
            tvResolution = itemView.findViewById(R.id.tvResolution);
            layoutResolution = itemView.findViewById(R.id.layoutResolution);
            btnRemove = itemView.findViewById(R.id.btnRemove);
        }
    }
}
