package com.example.shipper_app.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.shipper_app.R;
import com.example.shipper_app.model.ChatMessage;

import java.util.List;

public class ChatMessageAdapter extends RecyclerView.Adapter<ChatMessageAdapter.MessageViewHolder> {

    private Context context;
    private List<ChatMessage> messageList;

    public ChatMessageAdapter(Context context, List<ChatMessage> messageList) {
        this.context = context;
        this.messageList = messageList;
    }

    @NonNull
    @Override
    public MessageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context).inflate(R.layout.item_chat_message, parent, false);
        return new MessageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull MessageViewHolder holder, int position) {
        ChatMessage message = messageList.get(position);

        if (message.isSentByMe()) {
            holder.layoutSent.setVisibility(View.VISIBLE);
            holder.layoutReceived.setVisibility(View.GONE);
            holder.tvMessageSent.setText(message.getMessageText());
            holder.tvTimeSent.setText(message.getTime());
        } else {
            holder.layoutSent.setVisibility(View.GONE);
            holder.layoutReceived.setVisibility(View.VISIBLE);
            holder.tvMessageReceived.setText(message.getMessageText());
            holder.tvTimeReceived.setText(message.getTime());
        }
    }

    @Override
    public int getItemCount() {
        return messageList != null ? messageList.size() : 0;
    }

    public static class MessageViewHolder extends RecyclerView.ViewHolder {
        LinearLayout layoutSent, layoutReceived;
        TextView tvMessageSent, tvTimeSent;
        TextView tvMessageReceived, tvTimeReceived;

        public MessageViewHolder(@NonNull View itemView) {
            super(itemView);
            layoutSent = itemView.findViewById(R.id.layout_sent);
            layoutReceived = itemView.findViewById(R.id.layout_received);
            tvMessageSent = itemView.findViewById(R.id.tv_message_sent);
            tvTimeSent = itemView.findViewById(R.id.tv_time_sent);
            tvMessageReceived = itemView.findViewById(R.id.tv_message_received);
            tvTimeReceived = itemView.findViewById(R.id.tv_time_received);
        }
    }
}
