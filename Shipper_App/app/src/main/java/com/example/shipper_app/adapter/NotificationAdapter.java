package com.example.shipper_app.adapter;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.shipper_app.R;
import com.example.shipper_app.model.Notification;

import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Locale;

public class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.NotificationViewHolder> {

    private final Context context;
    private final List<Notification> notificationList;
    private OnNotificationClickListener listener;
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());

    public interface OnNotificationClickListener {
        void onNotificationClick(Notification notification, int position);
        void onDeleteClick(Notification notification, int position);
    }

    public NotificationAdapter(Context context, List<Notification> notificationList, OnNotificationClickListener listener) {
        this.context = context;
        this.notificationList = notificationList;
        this.listener = listener;
    }

    @NonNull
    @Override
    public NotificationViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_notification, parent, false);
        return new NotificationViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull NotificationViewHolder holder, int position) {
        Notification notification = notificationList.get(position);
        holder.bind(notification, position);
    }

    @Override
    public int getItemCount() {
        return notificationList != null ? notificationList.size() : 0;
    }

    public void updateData(List<Notification> newData) {
        notificationList.clear();
        notificationList.addAll(newData);
        notifyDataSetChanged();
    }

    class NotificationViewHolder extends RecyclerView.ViewHolder {

        private final TextView tvTitle;
        private final TextView tvBody;
        private final TextView tvTime;
        private final View indicatorUnread;
        private final View cardNotification;
        private final android.widget.ImageButton btnDelete;

        public NotificationViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tv_title);
            tvBody = itemView.findViewById(R.id.tv_body);
            tvTime = itemView.findViewById(R.id.tv_time);
            indicatorUnread = itemView.findViewById(R.id.indicator_unread);
            cardNotification = itemView.findViewById(R.id.card_notification);
            btnDelete = itemView.findViewById(R.id.btn_delete);
        }

        public void bind(Notification notification, int position) {
            tvTitle.setText(notification.getTitle() != null ? notification.getTitle() : "Thông báo");
            tvBody.setText(notification.getBody() != null ? notification.getBody() : "");
            
            if (notification.getCreatedAt() != null) {
                tvTime.setText(dateFormat.format(notification.getCreatedAt()));
            } else {
                tvTime.setText("");
            }

            // Giao diện thay đổi dựa trên trạng thái đã đọc
            if (notification.isRead()) {
                tvTitle.setTypeface(null, Typeface.NORMAL);
                indicatorUnread.setVisibility(View.GONE);
            } else {
                tvTitle.setTypeface(null, Typeface.BOLD);
                indicatorUnread.setVisibility(View.VISIBLE);
            }

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onNotificationClick(notification, position);
                }
            });

            btnDelete.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onDeleteClick(notification, position);
                }
            });
        }
    }
}
