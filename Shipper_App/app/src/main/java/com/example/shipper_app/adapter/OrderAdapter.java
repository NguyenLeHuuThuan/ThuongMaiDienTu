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

/**
 * Adapter hiển thị danh sách đơn hàng chờ nhận cho shipper
 */
public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {

    private final Context context;
    private final List<Order> orderList;
    private OnOrderClickListener listener;

    /**
     * Interface callback khi nhấn "Nhận đơn"
     */
    public interface OnOrderClickListener {
        void onAcceptOrder(Order order);
        void onViewOrderDetail(Order order);
    }

    public OrderAdapter(Context context, List<Order> orderList, OnOrderClickListener listener) {
        this.context = context;
        this.orderList = orderList;
        this.listener = listener;
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(context)
                .inflate(R.layout.item_order_card, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        Order order = orderList.get(position);
        holder.bind(order);
    }

    @Override
    public int getItemCount() {
        return orderList != null ? orderList.size() : 0;
    }

    /**
     * Cập nhật danh sách đơn hàng
     */
    public void updateOrders(List<Order> newOrders) {
        orderList.clear();
        orderList.addAll(newOrders);
        notifyDataSetChanged();
    }

    /**
     * Xóa đơn hàng sau khi shipper nhận
     */
    public void removeOrder(int position) {
        if (position >= 0 && position < orderList.size()) {
            orderList.remove(position);
            notifyItemRemoved(position);
            notifyItemRangeChanged(position, orderList.size());
        }
    }

    // ====== ViewHolder ======

    class OrderViewHolder extends RecyclerView.ViewHolder {

        private final TextView tvDistance;
        private final TextView tvShipFee;
        private final TextView tvPickupAddress;
        private final TextView tvDeliveryAddress;
        private final MaterialButton btnAcceptOrder;
        private final TextView tvReadyStatus;

        public OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            tvDistance = itemView.findViewById(R.id.tv_distance);
            tvShipFee = itemView.findViewById(R.id.tv_ship_fee);
            tvPickupAddress = itemView.findViewById(R.id.tv_pickup_address);
            tvDeliveryAddress = itemView.findViewById(R.id.tv_delivery_address);
            btnAcceptOrder = itemView.findViewById(R.id.btn_accept_order);
            tvReadyStatus = itemView.findViewById(R.id.tv_ready_status);
        }

        public void bind(Order order) {
            // Khoảng cách
            tvDistance.setText(order.getDistanceDisplay());

            // Phí ship nhận được
            if (order.getShipperEarned() != null) {
                tvShipFee.setText(Order.formatCurrency(order.getShipperEarned()));
            } else if (order.getShipFee() != null) {
                tvShipFee.setText(Order.formatCurrency(order.getShipFee()));
            }

            // Địa chỉ lấy hàng
            String pickupText = order.getRestaurantName() != null
                    ? order.getRestaurantName() + "\n" + order.getPickupAddress()
                    : order.getPickupAddress();
            tvPickupAddress.setText(pickupText);

            // Địa chỉ giao hàng
            tvDeliveryAddress.setText(order.getDeliveryAddress());

            // Nút Nhận đơn
            btnAcceptOrder.setOnClickListener(v -> {
                if (listener != null) {
                    // Hiệu ứng nhấn
                    v.animate().scaleX(0.95f).scaleY(0.95f).setDuration(80)
                            .withEndAction(() -> v.animate().scaleX(1f).scaleY(1f).setDuration(80).start())
                            .start();
                    listener.onAcceptOrder(order);
                }
            });

            // Nhấn vào toàn bộ item để xem chi tiết
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onViewOrderDetail(order);
                }
            });

            if (order.getReadyAt() != null) {
                String status = order.getOrderStatus();
                if (status != null) {
                    String lowerStatus = status.toLowerCase();
                    if (lowerStatus.equals("pending") || 
                        lowerStatus.equals("preparing") || 
                        lowerStatus.equals("delivering") || 
                        lowerStatus.equals("delivered")) {
                        tvReadyStatus.setVisibility(View.GONE);
                    } else {
                        tvReadyStatus.setVisibility(View.VISIBLE);
                    }
                } else {
                    tvReadyStatus.setVisibility(View.VISIBLE);
                }
            } else {
                tvReadyStatus.setVisibility(View.GONE);
            }
        }
    }
}
