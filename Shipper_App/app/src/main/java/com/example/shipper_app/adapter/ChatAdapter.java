package com.example.shipper_app.adapter;

import android.content.Context;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.cardview.widget.CardView;
import androidx.recyclerview.widget.RecyclerView;

import com.example.shipper_app.R;
import com.example.shipper_app.model.ChatSession;

import java.util.List;

public class ChatAdapter extends RecyclerView.Adapter<ChatAdapter.ChatViewHolder> {

    private Context context;
    private List<ChatSession> chatList;

    public ChatAdapter(Context context, List<ChatSession> chatList) {
        this.context = context;
        this.chatList = chatList;
    }

    @NonNull
    @Override
    public ChatViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_chat, parent, false);
        return new ChatViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ChatViewHolder holder, int position) {
        ChatSession chat = chatList.get(position);

        holder.tvName.setText(chat.getName());
        holder.tvTime.setText(chat.getTime());
        holder.tvMessage.setText(chat.getLastMessage());

        if (chat.getOrderId() != null && !chat.getOrderId().isEmpty()) {
            holder.tvOrderId.setVisibility(View.VISIBLE);
            holder.tvOrderId.setText(chat.getOrderId());
        } else {
            holder.tvOrderId.setVisibility(View.GONE);
        }

        holder.ivAvatar.setImageResource(chat.getAvatarResId());

        if (chat.isUnread()) {
            holder.viewUnreadMsg.setVisibility(View.VISIBLE);
            holder.viewUnreadAvatar.setVisibility(View.VISIBLE);
            holder.tvTime.setTextColor(Color.parseColor("#FF6600")); // color_primary
            holder.tvTime.setTypeface(null, android.graphics.Typeface.BOLD);
            holder.tvName.setTypeface(null, android.graphics.Typeface.BOLD);
            holder.tvMessage.setTypeface(null, android.graphics.Typeface.BOLD);
            holder.tvMessage.setTextColor(Color.parseColor("#1A1A1A")); // color_text_primary
        } else {
            holder.viewUnreadMsg.setVisibility(View.GONE);
            holder.viewUnreadAvatar.setVisibility(View.GONE);
            holder.tvTime.setTextColor(Color.parseColor("#6B6B6B")); // color_text_secondary
            holder.tvTime.setTypeface(null, android.graphics.Typeface.NORMAL);
            holder.tvName.setTypeface(null, android.graphics.Typeface.NORMAL);
            holder.tvMessage.setTypeface(null, android.graphics.Typeface.NORMAL);
            holder.tvMessage.setTextColor(Color.parseColor("#6B6B6B"));
        }

        // Apply background colors based on avatar type (Customer, Store, Other)
        if (chat.getAvatarResId() == R.drawable.ic_person_chat) {
            holder.cvAvatar.setCardBackgroundColor(Color.parseColor("#FFB380")); // Orange for customer
        } else if (chat.getAvatarResId() == R.drawable.ic_store) {
            holder.cvAvatar.setCardBackgroundColor(Color.parseColor("#F5E6E6")); // Light grey/red for store
        } else {
            holder.cvAvatar.setCardBackgroundColor(Color.parseColor("#6B6B6B")); // Grey for other
        }

        holder.itemView.setOnClickListener(v -> {
            android.content.Intent intent = new android.content.Intent(context, com.example.shipper_app.ChatDetailActivity.class);
            intent.putExtra("PARTNER_ID", chat.getPartnerId());
            intent.putExtra("PARTNER_NAME", chat.getName());
            context.startActivity(intent);
        });
    }

    @Override
    public int getItemCount() {
        return chatList != null ? chatList.size() : 0;
    }

    public static class ChatViewHolder extends RecyclerView.ViewHolder {
        CardView cvAvatar;
        ImageView ivAvatar;
        View viewUnreadAvatar;
        TextView tvName, tvTime, tvMessage, tvOrderId;
        View viewUnreadMsg;

        public ChatViewHolder(@NonNull View itemView) {
            super(itemView);
            cvAvatar = itemView.findViewById(R.id.cv_avatar);
            ivAvatar = itemView.findViewById(R.id.iv_avatar);
            viewUnreadAvatar = itemView.findViewById(R.id.view_unread_avatar);
            tvName = itemView.findViewById(R.id.tv_name);
            tvTime = itemView.findViewById(R.id.tv_time);
            tvMessage = itemView.findViewById(R.id.tv_message);
            tvOrderId = itemView.findViewById(R.id.tv_order_id);
            viewUnreadMsg = itemView.findViewById(R.id.view_unread_msg);
        }
    }
}
