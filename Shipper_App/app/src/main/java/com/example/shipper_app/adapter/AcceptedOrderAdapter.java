package com.example.shipper_app.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.shipper_app.R;
import com.example.shipper_app.model.Order;
import com.google.android.material.button.MaterialButton;

import java.util.List;

public class AcceptedOrderAdapter extends RecyclerView.Adapter<AcceptedOrderAdapter.AcceptedViewHolder> {

    private final Context context;
    private final List<Order> orderList;
    private OnAcceptedOrderClickListener listener;

    public interface OnAcceptedOrderClickListener {
        void onCancelOrder(Order order);
        void onViewOrderDetail(Order order);
    }

    public AcceptedOrderAdapter(Context context, List<Order> orderList, OnAcceptedOrderClickListener listener) {
        this.context = context;
        this.orderList = orderList;
        this.listener = listener;
    }

    @NonNull
    @Override
    public AcceptedViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context)
                .inflate(R.layout.item_accepted_order_card, parent, false);
        return new AcceptedViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull AcceptedViewHolder holder, int position) {
        Order order = orderList.get(position);
        holder.bind(order);
    }

    @Override
    public int getItemCount() {
        return orderList != null ? orderList.size() : 0;
    }

    public void updateOrders(List<Order> newOrders) {
        orderList.clear();
        orderList.addAll(newOrders);
        notifyDataSetChanged();
    }

    class AcceptedViewHolder extends RecyclerView.ViewHolder {

        private final TextView tvOrderStatusBadge;
        private final TextView tvOrderReadyBadge;
        private final TextView tvShipFee;
        private final TextView tvPickupAddress;
        private final TextView tvDeliveryAddress;
        private final MaterialButton btnCancelOrder;

        public AcceptedViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderStatusBadge = itemView.findViewById(R.id.tv_order_status_badge);
            tvOrderReadyBadge = itemView.findViewById(R.id.tv_order_ready_badge);
            tvShipFee = itemView.findViewById(R.id.tv_ship_fee);
            tvPickupAddress = itemView.findViewById(R.id.tv_pickup_address);
            tvDeliveryAddress = itemView.findViewById(R.id.tv_delivery_address);
            btnCancelOrder = itemView.findViewById(R.id.btn_cancel_order);
        }

        public void bind(Order order) {
            // Trạng thái đơn hàng
            String status = order.getOrderStatus();
            if ("delivering".equals(status)) {
                tvOrderStatusBadge.setText("Đang giao");
                tvOrderReadyBadge.setVisibility(View.GONE);
                btnCancelOrder.setVisibility(View.VISIBLE);
            } else if ("delivered".equals(status)) {
                tvOrderStatusBadge.setText("Đã giao hàng");
                tvOrderReadyBadge.setVisibility(View.GONE);
                btnCancelOrder.setVisibility(View.GONE);
            } else if ("ready".equalsIgnoreCase(status)) {
                tvOrderStatusBadge.setText("Đang lấy hàng");
                tvOrderReadyBadge.setVisibility(View.VISIBLE);
                btnCancelOrder.setVisibility(View.VISIBLE);
            } else {
                tvOrderStatusBadge.setText("Đang lấy hàng");
                tvOrderReadyBadge.setVisibility(View.GONE);
                btnCancelOrder.setVisibility(View.VISIBLE);
            }

            // Phí ship
            if (order.getShipFee() != null) {
                tvShipFee.setText(Order.formatCurrency(order.getShipFee()));
            }

            // Địa chỉ lấy hàng
            String pickupText = order.getRestaurantName() != null
                    ? order.getRestaurantName() + "\n" + order.getPickupAddress()
                    : order.getPickupAddress();
            tvPickupAddress.setText(pickupText);

            // Địa chỉ giao hàng
            tvDeliveryAddress.setText(order.getDeliveryAddress());

            // Nút Hủy giao hàng
            btnCancelOrder.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onCancelOrder(order);
                }
            });

            // Nhấn toàn bộ card để xem chi tiết
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onViewOrderDetail(order);
                }
            });
        }
    }
}
