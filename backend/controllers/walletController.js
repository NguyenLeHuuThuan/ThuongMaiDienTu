const { poolPromise } = require('../config/db');

// Lấy thông tin ví
exports.getWallet = async (req, res) => {
  try {
    const id_User = req.user.id;
    const pool = await poolPromise;

    // Lấy số dư
    const userRes = await pool.request()
      .input('id_User', id_User)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
    
    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }
    
    const wallet_balance = userRes.recordset[0].wallet_balance || 0;

    // Lấy lịch sử giao dịch
    const transRes = await pool.request()
      .input('id_User', id_User)
      .query(`
        SELECT id_Transaction, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At
        FROM Wallet_Transaction
        WHERE id_User = @id_User
        ORDER BY created_At DESC
      `);

    res.json({
      wallet_balance,
      transactions: transRes.recordset
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Nạp tiền
exports.deposit = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Số tiền không hợp lệ' });
  }

  try {
    const id_User = req.user.id;
    const pool = await poolPromise;

    // Lấy số dư hiện tại
    const userRes = await pool.request()
      .input('id_User', id_User)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
      
    const balance_before = userRes.recordset[0].wallet_balance || 0;
    const balance_after = balance_before + amount;

    // Cập nhật số dư và thêm giao dịch
    await pool.request()
      .input('id_User', id_User)
      .input('balance_after', balance_after)
      .input('amount', amount)
      .input('balance_before', balance_before)
      .input('note', 'Nạp tiền vào ví')
      .query(`
        UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @id_User;
        INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
        VALUES (@id_User, 'top_up', @amount, @balance_before, @balance_after, @note, GETDATE());
      `);

    res.json({ message: 'Nạp tiền thành công', wallet_balance: balance_after });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Rút tiền
exports.withdraw = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Số tiền không hợp lệ' });
  }

  try {
    const id_User = req.user.id;
    const pool = await poolPromise;

    // Lấy số dư hiện tại
    const userRes = await pool.request()
      .input('id_User', id_User)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
      
    const balance_before = userRes.recordset[0].wallet_balance || 0;
    
    if (balance_before < amount) {
      return res.status(400).json({ message: 'Số dư không đủ' });
    }

    const balance_after = balance_before - amount;

    // Cập nhật số dư và thêm giao dịch
    await pool.request()
      .input('id_User', id_User)
      .input('balance_after', balance_after)
      .input('amount', -amount)
      .input('balance_before', balance_before)
      .input('note', 'Rút tiền khỏi ví')
      .query(`
        UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @id_User;
        INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
        VALUES (@id_User, 'withdraw', @amount, @balance_before, @balance_after, @note, GETDATE());
      `);

    res.json({ message: 'Rút tiền thành công', wallet_balance: balance_after });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
